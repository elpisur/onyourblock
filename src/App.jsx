import { useState, useMemo, useEffect } from "react";
import { MapPin, Clock, ExternalLink, Calendar, Vote, Users, AlertCircle, Bell, Share2, ChevronRight, Info, Check, CalendarDays, List, DollarSign, TrendingUp, Sparkles, X, BellRing, ArrowUpRight, Mail, Phone, User, ThumbsUp, ThumbsDown, History, MapPinned, Globe, Flag, ShieldCheck, FileText, Heart, ArrowLeft, CheckCircle2, Building2, Accessibility } from "lucide-react";

// Evaluated at module load. Module reloads on browser refresh, which is
// effectively how often a user re-opens the page; drift across midnight in
// a long-lived tab is acceptable for the prototype.
const TODAY = new Date();
const APP_VERSION = "0.4.3-prototype";

// Format a Date as a short, human-readable "last updated" label.
// Returns "—" when no successful fetch has happened yet.
function formatLastUpdated(date) {
  if (!date) return "—";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  // Including seconds so a re-fetch within the same minute still produces a
  // visibly different label — useful for verifying the timestamp updates.
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  if (sameDay) return `today at ${time}`;
  if (isYesterday) return `yesterday at ${time}`;
  const day = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${day} at ${time}`;
}

// Translations — Spanish included as demonstration of i18n approach
const translations = {
  en: {
    tagline: "Civic actions, where you live",
    now: "Now", calendar: "Calendar", impact: "Impact", legacy: "Legacy",
    closesSoon: "Closes soon", thisWeek: "This week", upcoming: "Upcoming",
    whyItMatters: "Why it matters", voteNow: "Vote now", registered: "Registered",
    imRegistered: "I'm registered", whyWeAsk: "Why we ask",
    yourCouncilMember: "Your Representative", acted: "Acted", rippleMade: "Ripple made",
    checkInLater: "Check in later", missed: "Missed", didYouAttend: "Did you attend?",
    about: "About", privacy: "Privacy", terms: "Terms", reportMissing: "Report missing event",
    pageNotFound: "Nothing here yet",
  },
  es: {
    tagline: "Acciones cívicas, donde vives",
    now: "Ahora", calendar: "Calendario", impact: "Impacto", legacy: "Legado",
    closesSoon: "Cierra pronto", thisWeek: "Esta semana", upcoming: "Próximo",
    whyItMatters: "Por qué importa", voteNow: "Votar ahora", registered: "Registrado",
    imRegistered: "Estoy registrado", whyWeAsk: "Por qué preguntamos",
    yourCouncilMember: "Tu Representante", acted: "Actuó", rippleMade: "Onda creada",
    checkInLater: "Confirmar después", missed: "Perdido", didYouAttend: "¿Asististe?",
    about: "Acerca de", privacy: "Privacidad", terms: "Términos", reportMissing: "Reportar evento faltante",
    pageNotFound: "Nada por aquí todavía",
  },
};


// Real ballot items — sampled from actual 2026 PB ballots by district
const ballotPreviews = {
  "pb-vote-2026": {
    note: "Your ballot shows only projects in your district. Here's a sample of what's being voted on.",
    items: {
      "10011": [
        { title: "City Hall Park Lighting Upgrade", cost: "$1,000,000", desc: "Replace the non-functioning gas lights on the City Hall Park fountain with LED lights.", location: "City Hall Park" },
        { title: "Pier 42 Shade Structures", cost: "$1,000,000", desc: "Install sail shade structures at Pier 42, on the southside of the FDR Drive at Gouverneur Street.", location: "Pier 42" },
        { title: "Commercial Dishwasher for NYC H+H/Gouverneur", cost: "$350,000", desc: "Commercial dishwasher for the skilled nursing facility at NYC Health + Hospitals/Gouverneur, a 295-bed facility.", location: "277 Madison St" },
      ],
      "10024": [
        { title: "Library Technology Upgrades", cost: "$500,000", desc: "Replace aging public-use computer workstations at St. Agnes, Riverside, and Lincoln Center Performing Arts Library branches.", location: "Multiple UWS libraries" },
        { title: "John Jay Athletic Facility LED Boards", cost: "$750,000", desc: "Large indoor LED video display boards in the athletic facility at John Jay College of Criminal Justice for athletics and campus programming.", location: "John Jay College" },
        { title: "PS/IS 276 Playground & Track", cost: "$1,000,000", desc: "Renovate playground and convert track field at Battery Park City School.", location: "PS/IS 276" },
      ],
      "default": [
        { title: "Sample ballot item", cost: "$250,000", desc: "Ballot items vary by district. Enter your Manhattan ZIP to see real 2026 PB ballot samples.", location: "Your district" },
      ],
    },
  },
};

// Candidates for active elections (real, per ballotpedia.org where possible)
const candidatesByEvent = {
  "d3-special-early": [
    { name: "Keith Powers", party: "Democratic", campaignUrl: "https://www.keithpowersnyc.com/", ballotpediaUrl: "https://ballotpedia.org/Keith_Powers" },
    { name: "Maria Ortiz", party: "Democratic", campaignUrl: null, ballotpediaUrl: null },
    { name: "See full ballot", party: null, campaignUrl: "https://vote.nyc/", ballotpediaUrl: null, isFallback: true },
  ],
  "d3-special-day": [
    { name: "Keith Powers", party: "Democratic", campaignUrl: "https://www.keithpowersnyc.com/", ballotpediaUrl: "https://ballotpedia.org/Keith_Powers" },
    { name: "Maria Ortiz", party: "Democratic", campaignUrl: null, ballotpediaUrl: null },
    { name: "See full ballot", party: null, campaignUrl: "https://vote.nyc/", ballotpediaUrl: null, isFallback: true },
  ],
};

// Format an API outcome_status enum into the editorial label LegacyCard expects
// ("Funded for FY2026", "Completed 2024"). Pulls year from outcome_date or
// fiscal_year — never invents one.
function formatHistoryOutcome(status, outcomeDate, fiscalYear) {
  if (!status) return null;
  if (status === "funded" && fiscalYear) return `Funded for FY${fiscalYear}`;
  if (status === "in_progress") {
    if (outcomeDate) return `In progress (${outcomeDate.split("-")[0]})`;
    return "In progress";
  }
  if (status === "completed") {
    if (outcomeDate) return `Completed ${outcomeDate.split("-")[0]}`;
    return "Completed";
  }
  const s = status.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Map an API historical-project row to the shape LegacyCard consumes.
function transformApiHistoryProject(api) {
  return {
    id: api.id,
    year: api.announced_year,
    title: api.title,
    dollars: api.dollars,
    category: api.category,
    why: api.narrative,
    source: api.source_cycle,
    outcome: formatHistoryOutcome(api.outcome_status, api.outcome_date, api.fiscal_year),
  };
}

// Feature flag: the "pending certification" civic-results banner (a special
// election winner announced but not yet certified). Intentionally kept in the
// tree as future infrastructure but disabled — see the banner's TODO. Live data
// never sets pendingCertification today, so this is off in practice regardless.
const FEATURE_PENDING_CERTIFICATION = false;

// Hostname of a URL for display ("council.nyc.gov", "www.bernardsville.gov"),
// so link labels/footnotes read from the rep's own source instead of a
// hardcoded NYC domain. Returns "" if the URL is missing/unparseable.
function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// Map an API representative row (snake_case) to the shape the UI consumes.
// Jurisdiction-agnostic: office/jurisdiction labels come from the data, never
// hardcoded, so a NJ ZIP renders "Mayor"/"Bernardsville Borough" rather than
// NYC "Council Member"/"Council District". `district`/`districtNum` are kept for
// back-compat (and the disabled pendingCertification branch). Function/variable
// names still say "council" pending a separate cosmetic rename pass.
function transformApiCouncilMember(api) {
  return {
    name: api.name,
    vacant: api.vacant,
    office: api.office ?? "Representative",
    jurisdictionLabel: api.jurisdiction_label ?? api.district_name ?? "",
    jurisdictionArea: api.jurisdiction_area ?? null,
    level: api.level ?? null,
    usState: api.us_state ?? null,
    // Legacy geographic gloss (old district_name) — now jurisdiction_area.
    district: api.jurisdiction_area ?? api.district_name,
    districtNum: api.district_num ?? api.district,
    email: api.email,
    phone: api.phone,
    bio: api.bio_url,
    photo: api.photo_url,
    sourceUrl: api.source_url ?? api.bio_url,
    zips: api.zips,
    pendingCertification: false,
  };
}

// Transform a backend event (snake_case, nested action/source) into the
// camelCase shape the rest of the UI consumes. Keeping the transform here
// (close to the fetch) means downstream components don't need to change.
function transformApiEvent(api) {
  return {
    id: api.id,
    category: api.category,
    title: api.title,
    subtitle: api.subtitle ?? "",
    description: api.description ?? "",
    deadline: api.deadline,
    action: api.action?.label ?? "",
    actionType: api.action?.action_type ?? "reference",
    actionUrl: api.action?.url ?? "#",
    secondaryUrl: api.secondary_url ?? null,
    urgency: api.urgency,
    mobile: api.action?.is_mobile_friendly ?? true,
    scope: api.scope,
    zips: api.zips ?? [],
    sourceLabel: api.source?.name ?? "",
    requiresRegistration: api.requires_registration ?? false,
    isRegistrationGate: api.is_registration_gate ?? false,
    isResult: api.is_result ?? false,
    attribution: api.attribution ?? null,
    hasBallot: api.has_ballot ?? false,
    impact: api.impact ?? null,
    calendar: api.event_start && api.event_end
      ? { start: api.event_start, end: api.event_end }
      : null,
  };
}

const categoryMeta = {
  participatory_budgeting: { label: "Budget Vote", icon: Vote },
  election: { label: "Election", icon: Vote },
  registration: { label: "Registration", icon: Users },
  community_board: { label: "Community Board", icon: Users },
  oversight: { label: "Oversight", icon: AlertCircle },
};

const urgencyMeta = {
  critical: { dotColor: "bg-rose-500", textColor: "text-rose-600", bgColor: "bg-rose-50", borderColor: "border-rose-200" },
  soon: { dotColor: "bg-amber-500", textColor: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
  later: { dotColor: "bg-emerald-500", textColor: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
};

function timeUntil(dateStr) {
  const d = new Date(dateStr);
  const diffMs = d - TODAY;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (diffMs < 0) return "Passed";
  if (hours < 1) return "Less than 1 hr";
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} left`;
  if (days === 1) return "Tomorrow";
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.ceil(days / 7)} weeks`;
  return `${Math.ceil(days / 30)} months`;
}

function toGCalLink(event) {
  if (!event.calendar) return "#";
  const start = event.calendar.start.replace(/[-:]/g, "").split(".")[0];
  const end = event.calendar.end.replace(/[-:]/g, "").split(".")[0];
  const params = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates: `${start}/${end}`, details: `${event.description}\n\nMore info: ${event.actionUrl}`, location: event.subtitle });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function RippleIcon({ className = "w-4 h-4", filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="2.5" fill={filled ? "currentColor" : "none"} />
      <path d="M12 6.5 A 5.5 5.5 0 0 1 17.5 12" opacity="0.7" />
      <path d="M12 2 A 10 10 0 0 1 22 12" opacity="0.35" />
    </svg>
  );
}

function CouncilPhoto({ member, size = "sm" }) {
  const [imgErr, setImgErr] = useState(false);
  const dims = size === "lg" ? "w-16 h-16 text-xl rounded-2xl" : "w-6 h-6 text-[9px] rounded-full";
  const initial = member.name ? member.name.split(" ").slice(-1)[0][0] : "?";
  if (!imgErr && member.photo) {
    return <img src={member.photo} alt={member.name} onError={() => setImgErr(true)} className={`${dims} object-cover flex-shrink-0 ring-2 ring-white`} />;
  }
  return (
    <div className={`${dims} bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center text-white font-bold flex-shrink-0`} aria-label={`${member.name} avatar`}>
      {initial}
    </div>
  );
}

function CouncilMemberBadge({ councilMember, attribution }) {
  // These three chips are driven by event.attribution, an NYC-shaped enum the
  // backend only sets for NYC events — so they never render for a NJ ZIP and
  // can't mislabel a NJ rep. The literals "22 Council Members" and the
  // per-district "district_3" case are NYC-specific and NOT yet data-driven: the
  // participant count isn't in the API, so making them jurisdiction-general
  // needs a backend attribution change (tracked, out of scope for this commit).
  // We do NOT invent a count. The main rep line below ("Rep: {name}") is already
  // jurisdiction-neutral.
  if (attribution === "statewide") return <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-medium"><User className="w-3 h-3" /><span>Statewide action</span></div>;
  if (attribution === "multi_council") return <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-medium"><Users className="w-3 h-3" /><span>22 Council Members participating</span></div>;
  if (attribution === "district_3") return <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" /><span>Seat vacant — you choose</span></div>;
  if (!councilMember || councilMember.vacant) return null;
  return (
    <a href={councilMember.bio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-stone-600 font-medium hover:text-stone-900 transition focus:outline-none focus:ring-2 focus:ring-stone-400 rounded">
      <User className="w-3 h-3" />
      <span>Rep: {councilMember.name}</span>
      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
    </a>
  );
}

export default function OnYourBlockDashboard() {
  const [zip, setZip] = useState("10011");
  const [zipInput, setZipInput] = useState("10011");
  const [view, setView] = useState("feed");
  const [filter, setFilter] = useState("all");
  const [nudged, setNudged] = useState(new Set(["pb-vote-2026"]));
  const [registered, setRegistered] = useState(false);
  const [showImpact, setShowImpact] = useState(null);
  const [showCouncilMember, setShowCouncilMember] = useState(false);
  const [showWhyWeAsk, setShowWhyWeAsk] = useState(false);
  const [showReportMissing, setShowReportMissing] = useState(false);
  const [trustDoc, setTrustDoc] = useState(null); // "about" | "privacy" | "terms" | null
  const [actionStates, setActionStates] = useState(new Map());
  const [showOnboard, setShowOnboard] = useState(true);
  const [lang, setLang] = useState("en");
  const [civicData, setCivicData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [councilMember, setCouncilMember] = useState(null);
  const [historyState, setHistoryState] = useState({ projects: [], loading: true });
  const t = translations[lang];
  const lastUpdatedLabel = formatLastUpdated(lastUpdated);

  // Re-fetches whenever the active ZIP changes. The API matches by ZIP +
  // community board + council district server-side, so the response *is* the
  // event list for that ZIP — no client-side ZIP filter needed (CB-scoped
  // events come back with empty `zips` arrays, so filtering by ZIP here would
  // drop them). Dedupe/cancellation handled via the cancelled flag below.
  useEffect(() => {
    if (!zip || zip.length !== 5) return;
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    let cancelled = false;
    const work = baseUrl
      ? fetch(`${baseUrl}/v1/events?zip=${zip}`).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
      : Promise.reject(new Error("VITE_API_BASE_URL is not set"));
    work
      .then((response) => {
        if (cancelled) return;
        setCivicData((response.events ?? []).map(transformApiEvent));
        setError(null);
        // Only stamp on success — failed fetches keep showing the last
        // good timestamp so users see when the data they're looking at
        // was actually current.
        setLastUpdated(new Date());
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Unknown error");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [zip]);

  // Fetches the council member(s) covering the active ZIP. Independent from
  // the events fetch — a 404 here (ZIP we don't have a district mapping for)
  // shouldn't error-banner the events feed. Multiple districts are rare; we
  // take the first member.
  useEffect(() => {
    if (!zip || zip.length !== 5) return;
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    if (!baseUrl) return;
    let cancelled = false;
    fetch(`${baseUrl}/v1/council-members/by-zip/${zip}`)
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const first = data?.members?.[0];
        setCouncilMember(first ? transformApiCouncilMember(first) : null);
      })
      .catch(() => {
        if (cancelled) return;
        // Council member is auxiliary info — silently drop on transient
        // failures rather than blocking the page.
        setCouncilMember(null);
      });
    return () => {
      cancelled = true;
    };
  }, [zip]);

  // Fetches PB historical projects for the active ZIP. Independent from
  // the events and council-members fetches — failures here just leave the
  // Legacy view empty rather than blocking the page.
  useEffect(() => {
    if (!zip || zip.length !== 5) return;
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    if (!baseUrl) return;
    let cancelled = false;
    fetch(`${baseUrl}/v1/history?zip=${zip}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const projects = (data?.projects ?? []).map(transformApiHistoryProject);
        setHistoryState({ projects, loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setHistoryState({ projects: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [zip]);

  const events = useMemo(() => {
    // ZIP filtering happens server-side (see fetch effect above). Only
    // category and registration filters apply client-side.
    let filtered = [...civicData];
    if (registered) filtered = filtered.filter((e) => !e.isRegistrationGate);
    if (filter !== "all") filtered = filtered.filter((e) => e.category === filter);
    const urgencyOrder = { critical: 0, soon: 1, later: 2 };
    return filtered.sort((a, b) => {
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      return new Date(a.deadline) - new Date(b.deadline);
    });
  }, [filter, registered, civicData]);

  const criticalEvents = events.filter((e) => e.urgency === "critical" && actionStates.get(e.id)?.status !== "confirmed_attended");
  const confirmedRipples = useMemo(() => Array.from(actionStates.entries()).filter(([_, v]) => v.status === "confirmed_attended"), [actionStates]);
  const pendingConfirmations = useMemo(() => Array.from(actionStates.entries()).filter(([_, v]) => v.status === "pending_confirmation"), [actionStates]);
  const completedEvents = useMemo(() => confirmedRipples.map(([id, v]) => ({ ...civicData.find((e) => e.id === id), completedAt: v.timestamp })).filter((e) => e.id).sort((a, b) => b.completedAt - a.completedAt), [confirmedRipples, civicData]);

  const toggleNudge = (id) => setNudged((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const recordIntent = (event) => {
    setActionStates((prev) => {
      const next = new Map(prev);
      const current = next.get(event.id);
      if (event.actionType === "online_vote") next.set(event.id, { status: "confirmed_attended", timestamp: Date.now() });
      else next.set(event.id, { status: current?.status === "confirmed_attended" ? "confirmed_attended" : "pending_confirmation", timestamp: Date.now() });
      return next;
    });
  };
  const confirmAttendance = (id, didAttend) => {
    setActionStates((prev) => { const next = new Map(prev); next.set(id, { status: didAttend ? "confirmed_attended" : "confirmed_missed", timestamp: Date.now() }); return next; });
  };
  const applyZip = () => { if (zipInput.length === 5) setZip(zipInput); };

  const activeEvent = civicData.find((e) => e.id === showImpact);
  const activeCouncilMember = councilMember;
  const localHistory = historyState;

  // Render a full trust document page if one is open
  if (trustDoc) return <TrustDocumentPage doc={trustDoc} onClose={() => setTrustDoc(null)} t={t} lastUpdatedLabel={lastUpdatedLabel} />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 text-stone-900 motion-safe:transition-colors" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      {showOnboard && (
        <div className="bg-stone-900 text-white" role="banner">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span className="opacity-90">Prototype · Real NYC data, updated {lastUpdatedLabel}</span>
            </div>
            <button onClick={() => setShowOnboard(false)} aria-label="Dismiss banner" className="opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded p-0.5"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      <header className="bg-white/85 backdrop-blur-xl border-b border-stone-200 sticky top-0 z-20" role="banner">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-stone-900 rounded-xl flex items-center justify-center shadow-sm" aria-hidden="true">
              <MapPinned className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-base leading-tight tracking-tight">On Your Block</div>
              <div className="text-[11px] text-stone-500 leading-tight">{t.tagline}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 bg-stone-100 rounded-full px-3 py-1.5 text-xs cursor-text focus-within:ring-2 focus-within:ring-stone-400">
              <MapPin className="w-3 h-3 text-stone-500" aria-hidden="true" />
              <span className="sr-only">ZIP code</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zipInput}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setZipInput(v);
                  if (v.length === 5) setZip(v);
                  else if (v.length === 0) setZip("");
                }}
                onBlur={applyZip}
                onKeyDown={(e) => e.key === "Enter" && applyZip()}
                placeholder="ZIP"
                className="w-14 bg-transparent outline-none font-medium text-stone-800"
                aria-label="Enter your ZIP code"
              />
            </label>
            <button onClick={() => setLang(lang === "en" ? "es" : "en")} aria-label="Switch language" className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border border-stone-200 bg-white text-stone-600 hover:border-stone-300 transition focus:outline-none focus:ring-2 focus:ring-stone-400">
              <Globe className="w-3 h-3" />
              {lang.toUpperCase()}
            </button>
          </div>
        </div>

        {/* Registered toggle with "why we ask" */}
        <div className="max-w-5xl mx-auto px-4 pb-2 flex items-center gap-2">
          <button onClick={() => setRegistered(!registered)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition focus:outline-none focus:ring-2 focus:ring-stone-400 ${registered ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"}`} aria-pressed={registered}>
            <Check className={`w-3 h-3 ${registered ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
            {registered ? t.registered : t.imRegistered}
          </button>
          <button onClick={() => setShowWhyWeAsk(true)} className="text-[11px] text-stone-500 underline underline-offset-2 hover:text-stone-800 transition focus:outline-none focus:ring-2 focus:ring-stone-400 rounded">
            {t.whyWeAsk}
          </button>
        </div>

        {activeCouncilMember && (
          <div className="max-w-5xl mx-auto px-4 pb-2">
            {activeCouncilMember.vacant ? (
              <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-2" role="status">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>Your seat in <span className="font-semibold">{activeCouncilMember.jurisdictionLabel}</span> is currently vacant.</span>
              </div>
            ) : FEATURE_PENDING_CERTIFICATION && activeCouncilMember.pendingCertification ? (
              // TODO(civic-results): future infrastructure for a "winner declared,
              // not yet certified" state. Disabled via FEATURE_PENDING_CERTIFICATION
              // until a real results source drives it — the name/date below are
              // placeholders, never shown while the flag is off. Kept intentionally;
              // revisit wiring it up as its own workstream. Uses jurisdictionLabel,
              // not a hardcoded "District N", when re-enabled.
              <div className="flex items-center gap-2 text-xs bg-sky-50 text-sky-800 border border-sky-200 rounded-lg px-3 py-2" role="status">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>A winner was declared in <span className="font-semibold">{activeCouncilMember.jurisdictionLabel}</span>. Contact info will populate once results are certified.</span>
              </div>
            ) : (
              <button onClick={() => setShowCouncilMember(true)} className="w-full flex items-center justify-between gap-2 text-xs bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 transition text-left group focus:outline-none focus:ring-2 focus:ring-stone-400">
                <div className="flex items-center gap-2 min-w-0">
                  <CouncilPhoto member={activeCouncilMember} />
                  <div className="min-w-0">
                    <div className="text-stone-500 text-[10px] uppercase tracking-wider font-semibold">{activeCouncilMember.office ? `Your ${activeCouncilMember.office}` : t.yourCouncilMember}</div>
                    <div className="font-semibold text-stone-900 truncate">{activeCouncilMember.name}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 motion-safe:group-hover:translate-x-0.5 motion-safe:transition flex-shrink-0" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 pb-3" role="tablist">
          <div className="inline-flex bg-stone-100 rounded-full p-1 text-xs font-medium">
            <ViewTab active={view === "feed"} onClick={() => setView("feed")} icon={List} label={t.now} />
            <ViewTab active={view === "calendar"} onClick={() => setView("calendar")} icon={CalendarDays} label={t.calendar} />
            <ViewTab active={view === "impact"} onClick={() => setView("impact")} icon={RippleIcon} label={t.impact} count={confirmedRipples.length} />
            <ViewTab active={view === "history"} onClick={() => setView("history")} icon={History} label={t.legacy} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 pb-28" role="main">
        {view === "feed" && pendingConfirmations.length > 0 && (
          <div className="mb-5 bg-sky-50 border border-sky-200 rounded-2xl p-4" role="region" aria-label="Pending check-ins">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center"><ThumbsUp className="w-3 h-3 text-sky-700" aria-hidden="true" /></div>
              <div className="text-sm font-semibold text-sky-900">Quick check-in</div>
            </div>
            <div className="text-xs text-sky-800 mb-3">Did you make it to these? Your honest answer keeps your impact record accurate.</div>
            <div className="space-y-2">
              {pendingConfirmations.map(([id]) => {
                const event = civicData.find((e) => e.id === id);
                if (!event) return null;
                return (
                  <div key={id} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-sky-100">
                    <div className="text-xs font-medium flex-1 min-w-0 truncate">{event.title}</div>
                    <button onClick={() => confirmAttendance(id, true)} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition focus:outline-none focus:ring-2 focus:ring-emerald-400"><ThumbsUp className="w-3 h-3" aria-hidden="true" /> Yes</button>
                    <button onClick={() => confirmAttendance(id, false)} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100 transition focus:outline-none focus:ring-2 focus:ring-stone-400"><ThumbsDown className="w-3 h-3" aria-hidden="true" /> Missed</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "feed" && criticalEvents.length > 0 && (
          <div className="mb-5 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-2xl p-4 shadow-lg shadow-rose-200" role="alert">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 backdrop-blur" aria-hidden="true">
                <div className="w-2.5 h-2.5 bg-white rounded-full motion-safe:animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider opacity-90 mb-0.5">{t.closesSoon}</div>
                <div className="font-bold text-lg leading-tight mb-0.5">{criticalEvents[0].title}</div>
                <div className="text-sm opacity-90">{timeUntil(criticalEvents[0].deadline)} · {criticalEvents[0].action}</div>
              </div>
              <a href={criticalEvents[0].actionUrl} target="_blank" rel="noopener noreferrer" onClick={() => recordIntent(criticalEvents[0])} className="flex-shrink-0 bg-white text-rose-600 font-semibold text-sm px-4 py-2 rounded-full hover:bg-rose-50 transition inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-white">
                Go <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        )}

        {view === "feed" && (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide" role="tablist" aria-label="Filter by category">
              <Pill active={filter === "all"} onClick={() => setFilter("all")} label="All" count={events.length} />
              {Object.entries(categoryMeta).map(([key, meta]) => {
                const count = civicData.filter((e) => e.category === key).length;
                if (count === 0) return null;
                return <Pill key={key} active={filter === key} onClick={() => setFilter(key)} label={meta.label} count={count} />;
              })}
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="text-center text-sm text-stone-500 py-12">Loading…</div>
              ) : error ? (
                <div className="border border-rose-200 bg-rose-50 text-rose-800 rounded-2xl p-4 text-sm">
                  Couldn't load events: {error}
                </div>
              ) : events.length === 0 ? (
                <EmptyState t={t} />
              ) : (
                events.map((event) => (
                  <EventCard key={event.id} event={event} zip={zip} councilMember={councilMember} nudged={nudged.has(event.id)} state={actionStates.get(event.id)} registered={registered} onNudge={() => toggleNudge(event.id)} onIntent={() => recordIntent(event)} onConfirm={(didAttend) => confirmAttendance(event.id, didAttend)} onImpact={() => setShowImpact(event.id)} t={t} />
                ))
              )}
            </div>
          </>
        )}

        {view === "calendar" && <CalendarView events={events} onEventClick={(e) => setShowImpact(e.id)} />}
        {view === "impact" && <ImpactHistoryView completedEvents={completedEvents} onEventClick={(e) => setShowImpact(e.id)} />}
        {view === "history" && <LegacyView history={localHistory} zip={zip} />}
      </main>

      {/* Footer with trust docs */}
      <footer className="max-w-5xl mx-auto px-4 pb-24 pt-6 border-t border-stone-200/60 mt-8" role="contentinfo">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-stone-500">
          <div className="flex items-center gap-3">
            <button onClick={() => setTrustDoc("about")} className="hover:text-stone-800 transition focus:outline-none focus:ring-2 focus:ring-stone-400 rounded">{t.about}</button>
            <span aria-hidden="true">·</span>
            <button onClick={() => setTrustDoc("privacy")} className="hover:text-stone-800 transition focus:outline-none focus:ring-2 focus:ring-stone-400 rounded">{t.privacy}</button>
            <span aria-hidden="true">·</span>
            <button onClick={() => setTrustDoc("terms")} className="hover:text-stone-800 transition focus:outline-none focus:ring-2 focus:ring-stone-400 rounded">{t.terms}</button>
            <span aria-hidden="true">·</span>
            <button onClick={() => setShowReportMissing(true)} className="hover:text-stone-800 transition focus:outline-none focus:ring-2 focus:ring-stone-400 rounded">{t.reportMissing}</button>
          </div>
          <div className="flex items-center gap-2">
            <span>v{APP_VERSION}</span>
            <span aria-hidden="true">·</span>
            <span>Updated {lastUpdatedLabel}</span>
          </div>
        </div>
      </footer>

      {/* Floating status bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
        <div className="max-w-5xl mx-auto px-4 pb-4">
          <div className="pointer-events-auto bg-white/90 backdrop-blur-xl border border-stone-200 rounded-2xl shadow-xl px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 text-stone-700">
                <RippleIcon className="w-4 h-4" filled={confirmedRipples.length > 0} />
              </div>
              <div className="text-xs min-w-0">
                <div className="font-semibold truncate">{confirmedRipples.length === 0 ? "Start making ripples" : `${confirmedRipples.length} ${confirmedRipples.length === 1 ? "ripple made" : "ripples made"}`}</div>
                <div className="text-stone-500 truncate">{pendingConfirmations.length > 0 ? `${pendingConfirmations.length} pending check-in` : `${events.length} ${events.length === 1 ? "action" : "actions"} nearby`}</div>
              </div>
            </div>
            <button className="flex-shrink-0 bg-stone-900 text-white text-xs font-semibold px-3 py-2 rounded-full hover:bg-stone-800 transition flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400" onClick={() => { if (typeof Notification !== "undefined") Notification.requestPermission?.(); alert("In production: this triggers the Web Push permission prompt + registers a service worker for background notifications."); }}>
              <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
              Alerts
            </button>
          </div>
        </div>
      </div>

      {activeEvent && <ImpactSheet event={activeEvent} zip={zip} councilMember={councilMember} registered={registered} onClose={() => setShowImpact(null)} onIntent={() => recordIntent(activeEvent)} />}
      {showCouncilMember && activeCouncilMember && !activeCouncilMember.vacant && <CouncilMemberSheet member={activeCouncilMember} onClose={() => setShowCouncilMember(false)} />}
      {showWhyWeAsk && <WhyWeAskSheet onClose={() => setShowWhyWeAsk(false)} onOpenPrivacy={() => { setShowWhyWeAsk(false); setTrustDoc("privacy"); }} />}
      {showReportMissing && <ReportMissingSheet onClose={() => setShowReportMissing(false)} />}
    </div>
  );
}

function ViewTab({ active, onClick, icon: Icon, label, count }) {
  return (
    <button onClick={onClick} role="tab" aria-selected={active} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition focus:outline-none focus:ring-2 focus:ring-stone-400 ${active ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
      {count !== undefined && count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-600"}`}>{count}</span>}
    </button>
  );
}

function Pill({ active, onClick, label, count }) {
  return (
    <button onClick={onClick} role="tab" aria-selected={active} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition focus:outline-none focus:ring-2 focus:ring-stone-400 ${active ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"}`}>
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-stone-100"}`}>{count}</span>
    </button>
  );
}

function EventCard({ event, zip, councilMember, nudged, state, registered, onNudge, onIntent, onConfirm, onImpact, t }) {
  const [showBallot, setShowBallot] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const urgency = urgencyMeta[event.urgency];
  const cat = categoryMeta[event.category];
  const Icon = cat.icon;
  const status = state?.status;
  const isConfirmed = status === "confirmed_attended";
  const isPending = status === "pending_confirmation";
  const isMissed = status === "confirmed_missed";

  const actionLabel = event.requiresRegistration && registered && event.action.toLowerCase().includes("register") ? t.voteNow : event.action;
  const mainButtonLabel = isConfirmed ? t.acted : isMissed ? "View details" : actionLabel;
  const ballotItems = event.hasBallot ? (ballotPreviews[event.id]?.items[zip] || ballotPreviews[event.id]?.items["default"] || []) : [];
  const candidates = candidatesByEvent[event.id];

  return (
    <article className={`group bg-white rounded-2xl border overflow-hidden transition-all ${isConfirmed ? "border-emerald-200 bg-emerald-50/30" : isMissed ? "border-stone-200 opacity-70" : event.urgency === "critical" ? "border-rose-200 shadow-sm shadow-rose-100/50" : "border-stone-200 hover:border-stone-300 hover:shadow-md"}`}>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${urgency.dotColor}`} aria-hidden="true" />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${urgency.textColor}`}>{timeUntil(event.deadline)}</span>
            <span className="text-stone-300" aria-hidden="true">·</span>
            <span className="text-[11px] text-stone-500 flex items-center gap-1"><Icon className="w-3 h-3" aria-hidden="true" />{cat.label}</span>
          </div>
          {isConfirmed && <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium"><RippleIcon className="w-3 h-3" filled /> {t.rippleMade}</span>}
          {isPending && <span className="text-[11px] text-sky-700 flex items-center gap-1 font-medium"><Clock className="w-3 h-3" aria-hidden="true" /> {t.checkInLater}</span>}
          {isMissed && <span className="text-[11px] text-stone-500 flex items-center gap-1 font-medium">{t.missed}</span>}
        </div>

        <h3 className={`font-bold text-[17px] leading-snug tracking-tight mb-1 ${isConfirmed ? "text-stone-700" : isMissed ? "text-stone-500" : ""}`}>{event.title}</h3>
        <div className="text-sm text-stone-600 mb-2">{event.subtitle}</div>
        <p className="text-sm text-stone-700 leading-relaxed mb-3">{event.description}</p>

        <div className="mb-3"><CouncilMemberBadge councilMember={councilMember} attribution={event.attribution} /></div>

        <button onClick={onImpact} className="w-full text-left bg-gradient-to-r from-stone-50 to-stone-100/50 hover:from-stone-100 hover:to-stone-100 border border-stone-200/50 rounded-xl px-3 py-2.5 mb-3 transition group/impact focus:outline-none focus:ring-2 focus:ring-stone-400">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5"><TrendingUp className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-0.5">{t.whyItMatters}</div>
              <div className="text-xs text-stone-700 leading-relaxed">
                {event.impact.dollars && <span className="font-bold text-stone-900">{event.impact.dollars} · </span>}
                This {event.impact.text}.
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400 mt-1 motion-safe:group-hover/impact:translate-x-0.5 motion-safe:transition" aria-hidden="true" />
          </div>
        </button>

        {/* Ballot preview — expandable */}
        {event.hasBallot && ballotItems.length > 0 && (
          <div className="mb-3">
            <button onClick={() => setShowBallot(!showBallot)} aria-expanded={showBallot} className="w-full text-left bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl px-3 py-2.5 transition flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-violet-400">
              <div className="w-6 h-6 rounded-lg bg-violet-200 flex items-center justify-center flex-shrink-0"><FileText className="w-3.5 h-3.5 text-violet-800" aria-hidden="true" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">Preview your ballot</div>
                <div className="text-xs text-violet-900 leading-relaxed">{ballotItems.length} projects on your ballot</div>
              </div>
              <ChevronRight className={`w-4 h-4 text-violet-600 transition motion-safe:${showBallot ? "rotate-90" : ""}`} aria-hidden="true" />
            </button>
            {showBallot && (
              <div className="mt-2 space-y-2 pl-2">
                {ballotItems.map((item, idx) => (
                  <div key={idx} className="bg-white border border-violet-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-semibold text-sm leading-tight flex-1">{item.title}</div>
                      <div className="text-xs font-bold text-violet-700 flex-shrink-0">{item.cost}</div>
                    </div>
                    <div className="text-xs text-stone-600 mb-1 leading-relaxed">{item.desc}</div>
                    <div className="text-[11px] text-stone-500 flex items-center gap-1"><MapPin className="w-3 h-3" aria-hidden="true" /> {item.location}</div>
                  </div>
                ))}
                <div className="text-[11px] text-violet-700 pt-1">{ballotPreviews[event.id].note}</div>
              </div>
            )}
          </div>
        )}

        {/* Candidate info — link-out only */}
        {candidates && (
          <div className="mb-3">
            <button onClick={() => setShowCandidates(!showCandidates)} aria-expanded={showCandidates} className="w-full text-left bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl px-3 py-2.5 transition flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <div className="w-6 h-6 rounded-lg bg-indigo-200 flex items-center justify-center flex-shrink-0"><Users className="w-3.5 h-3.5 text-indigo-800" aria-hidden="true" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Who's on the ballot</div>
                <div className="text-xs text-indigo-900 leading-relaxed">{candidates.filter(c => !c.isFallback).length} candidates · links to their own sites</div>
              </div>
              <ChevronRight className={`w-4 h-4 text-indigo-600 transition motion-safe:${showCandidates ? "rotate-90" : ""}`} aria-hidden="true" />
            </button>
            {showCandidates && (
              <div className="mt-2 space-y-1.5 pl-2">
                {candidates.map((c, idx) => (
                  <div key={idx} className={`flex items-center justify-between gap-2 bg-white border border-indigo-100 rounded-lg px-3 py-2 ${c.isFallback ? "italic" : ""}`}>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      {c.party && <div className="text-[11px] text-stone-500">{c.party}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      {c.campaignUrl && <a href={c.campaignUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-indigo-700 hover:text-indigo-900 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400">Campaign</a>}
                      {c.ballotpediaUrl && <a href={c.ballotpediaUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-indigo-700 hover:text-indigo-900 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400">Ballotpedia</a>}
                    </div>
                  </div>
                ))}
                <div className="text-[11px] text-indigo-700 pt-1 leading-relaxed">We link to each candidate's own materials. On Your Block doesn't endorse candidates.</div>
              </div>
            )}
          </div>
        )}

        {/* Action type hints */}
        {event.actionType === "virtual_meeting" && !isConfirmed && !isMissed && (
          <div className="flex items-start gap-1.5 text-[11px] text-stone-500 mb-2.5 leading-relaxed"><Info className="w-3 h-3 flex-shrink-0 mt-0.5" aria-hidden="true" /><span>Clicking the link doesn't mark attendance — we'll check in with you after the meeting.</span></div>
        )}
        {event.actionType === "in_person" && !isConfirmed && !isMissed && (
          <div className="flex items-start gap-1.5 text-[11px] text-stone-500 mb-2.5 leading-relaxed"><Info className="w-3 h-3 flex-shrink-0 mt-0.5" aria-hidden="true" /><span>Your ripple is confirmed when you tell us you went — we trust you.</span></div>
        )}

        <div className="flex items-center gap-2">
          <a href={event.actionUrl} target="_blank" rel="noopener noreferrer" onClick={onIntent} className={`flex-1 inline-flex items-center justify-center gap-1.5 font-semibold text-sm px-4 py-2.5 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-amber-400 ${isConfirmed ? "bg-emerald-100 text-emerald-700" : event.urgency === "critical" ? "bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-200" : "bg-stone-900 text-white hover:bg-stone-800"}`}>
            {mainButtonLabel}
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
          </a>

          {event.actionType === "in_person" && isPending && (
            <button onClick={() => onConfirm(true)} aria-label="I went" className="h-10 px-3 flex items-center justify-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition focus:outline-none focus:ring-2 focus:ring-emerald-400"><Check className="w-3.5 h-3.5" aria-hidden="true" /> I went</button>
          )}

          <button onClick={onNudge} aria-label={nudged ? "Stop alerts" : "Get alerts"} aria-pressed={nudged} className={`w-10 h-10 flex items-center justify-center rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-stone-400 ${nudged ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-stone-200 text-stone-500 hover:border-stone-300"}`}>
            <Bell className={`w-4 h-4 ${nudged ? "fill-amber-400" : ""}`} aria-hidden="true" />
          </button>

          <a href={toGCalLink(event)} target="_blank" rel="noopener noreferrer" aria-label="Add to calendar" className="w-10 h-10 flex items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700 transition focus:outline-none focus:ring-2 focus:ring-stone-400">
            <CalendarDays className="w-4 h-4" aria-hidden="true" />
          </a>

          <button onClick={() => { if (navigator.share) navigator.share({ title: event.title, text: event.subtitle, url: event.actionUrl }); else navigator.clipboard?.writeText(event.actionUrl); }} aria-label="Share" className="w-10 h-10 flex items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700 transition focus:outline-none focus:ring-2 focus:ring-stone-400">
            <Share2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

function CalendarView({ events, onEventClick }) {
  const start = new Date(2026, 3, 26); // April 26, 2026 (Sunday in week before May 3)
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const formatKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const eventsByDate = useMemo(() => { const map = {}; events.forEach((e) => { const key = e.deadline.split("T")[0]; if (!map[key]) map[key] = []; map[key].push(e); }); return map; }, [events]);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
        <h2 className="font-bold text-base tracking-tight">April – May 2026</h2>
        <div className="text-xs text-stone-500">{events.length} items</div>
      </div>
      <div className="grid grid-cols-7 text-[10px] font-semibold uppercase tracking-wider text-stone-400 px-2 pt-2" aria-hidden="true">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-center py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 p-2" role="grid">
        {days.map((day, i) => {
          const key = formatKey(day);
          const dayEvents = eventsByDate[key] || [];
          const isToday = key === formatKey(TODAY);
          const isPast = day < TODAY && !isToday;
          const month = day.getMonth();
          return (
            <div key={i} role="gridcell" className={`aspect-square min-h-[60px] rounded-lg p-1.5 text-left flex flex-col ${isToday ? "bg-amber-50 ring-2 ring-amber-400" : isPast ? "bg-stone-50 opacity-40" : "bg-stone-50/50 hover:bg-stone-100/50"} transition`}>
              <div className={`text-[11px] font-semibold mb-0.5 ${isToday ? "text-amber-900" : month === 3 ? "text-stone-700" : "text-stone-400"}`}>{day.getDate()}</div>
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 2).map((e) => {
                  const urgency = urgencyMeta[e.urgency];
                  return <button key={e.id} onClick={() => onEventClick(e)} className={`w-full text-left text-[9px] leading-tight px-1 py-0.5 rounded truncate font-medium ${urgency.bgColor} ${urgency.textColor} focus:outline-none focus:ring-1 focus:ring-stone-400`}>{e.title}</button>;
                })}
                {dayEvents.length > 2 && <div className="text-[9px] text-stone-500 px-1">+{dayEvents.length - 2}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-stone-200 flex items-center gap-3 text-[11px] text-stone-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" aria-hidden="true" /> Closes soon</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" /> This week</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" /> Upcoming</span>
      </div>
    </div>
  );
}

function ImpactHistoryView({ completedEvents, onEventClick }) {
  if (completedEvents.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
        <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3 text-stone-400"><RippleIcon className="w-6 h-6" /></div>
        <div className="font-semibold text-stone-800 mb-1">No ripples yet</div>
        <div className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">When you confirm a civic action — a vote, a meeting attended, a comment submitted — it lands here as part of your local impact record.</div>
      </div>
    );
  }
  const totalDollars = completedEvents.map((e) => e.impact?.dollars).filter(Boolean).reduce((acc, d) => acc + parseFloat(d.replace(/[$M]/g, "")), 0);
  const issueAreas = [...new Set(completedEvents.flatMap((e) => e.impact?.areas || []))];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-white rounded-2xl p-6 overflow-hidden relative">
        <div className="absolute -right-8 -top-8 w-40 h-40 opacity-10" aria-hidden="true"><RippleIcon className="w-full h-full" filled /></div>
        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1.5"><RippleIcon className="w-3.5 h-3.5" filled /> Your impact</div>
          <div className="text-4xl font-black tracking-tight mb-1">{completedEvents.length} {completedEvents.length === 1 ? "ripple" : "ripples"}</div>
          <div className="text-sm text-stone-300 mb-5">Every confirmed action shapes your block, your neighborhood, your city.</div>
          <div className="grid grid-cols-2 gap-3">
            {totalDollars > 0 && <div><div className="text-[11px] uppercase tracking-wider text-stone-400 mb-1">Dollars shaped</div><div className="text-2xl font-bold">${totalDollars}M+</div></div>}
            {issueAreas.length > 0 && <div><div className="text-[11px] uppercase tracking-wider text-stone-400 mb-1">Areas touched</div><div className="text-2xl font-bold">{issueAreas.length}</div></div>}
          </div>
        </div>
      </div>
      {issueAreas.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2">Issues you've weighed in on</div>
          <div className="flex flex-wrap gap-1.5">{issueAreas.map((area) => <span key={area} className="text-xs font-medium bg-stone-100 text-stone-800 px-2.5 py-1 rounded-full">{area}</span>)}</div>
        </div>
      )}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2 px-1">History</div>
        <div className="space-y-2">
          {completedEvents.map((event) => {
            const cat = categoryMeta[event.category];
            const Icon = cat.icon;
            const completedDate = new Date(event.completedAt);
            return (
              <button key={event.id} onClick={() => onEventClick(event)} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-left hover:border-stone-300 transition flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-stone-400">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0"><RippleIcon className="w-5 h-5" filled /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{event.title}</div>
                  <div className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
                    <Icon className="w-3 h-3" aria-hidden="true" />{cat.label}<span>·</span>
                    <span>{completedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    {event.impact?.dollars && <><span>·</span><span className="font-semibold text-stone-700">{event.impact.dollars}</span></>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LegacyView({ history, zip }) {
  const { projects, loading } = history;

  if (loading) {
    return <div className="text-center text-sm text-stone-500 py-12">Loading…</div>;
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
        <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3 text-stone-400"><History className="w-6 h-6" /></div>
        <div className="font-semibold text-stone-800 mb-1">No neighborhood history yet</div>
        <div className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">No civic project history on file for this ZIP yet. Try a different one — coverage varies by area.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1.5"><History className="w-3.5 h-3.5" aria-hidden="true" /> Because your neighbors voted</div>
        <h2 className="font-bold text-xl tracking-tight leading-tight mb-2">This is why your block looks the way it does</h2>
        <p className="text-sm text-stone-600 leading-relaxed">These are real projects funded by Participatory Budgeting votes. The park bench, the library computer, the safer crosswalk — someone voted for it.</p>
      </div>

      <div className="flex items-center gap-2 pt-2 px-1">
        <MapPin className="w-3.5 h-3.5 text-stone-600" aria-hidden="true" />
        <div className="text-xs font-semibold uppercase tracking-wider text-stone-700">In your area</div>
      </div>
      <div className="space-y-3">
        {projects.map((item) => <LegacyCard key={item.id} item={item} />)}
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-2xl p-5 text-center">
        <div className="text-sm font-semibold text-amber-900 mb-1">Your vote becomes next year's legacy.</div>
        <div className="text-xs text-amber-800">PB Cycle 15 voting just closed — results arrive in May. What did your district fund this time?</div>
      </div>
    </div>
  );
}

function LegacyCard({ item, faded = false }) {
  return (
    <article className={`bg-white border border-stone-200 rounded-2xl overflow-hidden hover:border-stone-300 transition ${faded ? "opacity-75" : ""}`}>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{item.year}</span>
          <span className="text-stone-300" aria-hidden="true">·</span>
          <span className="text-[11px] text-stone-500">{item.category}</span>
          {item.outcome && <><span className="text-stone-300" aria-hidden="true">·</span><span className="text-[11px] text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" aria-hidden="true" />{item.outcome}</span></>}
        </div>
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[17px] leading-snug tracking-tight mb-1">{item.title}</h3>
            <p className="text-sm text-stone-700 leading-relaxed mb-3">{item.why}</p>
            <div className="flex items-center gap-2 text-xs text-stone-500"><Info className="w-3 h-3" aria-hidden="true" /><span>Source: {item.source}</span></div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">Funded</div>
            <div className="text-2xl font-black tracking-tight">{item.dollars}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ImpactSheet({ event, zip, councilMember, registered, onClose, onIntent }) {
  const actionLabel = event.requiresRegistration && registered && event.action.toLowerCase().includes("register") ? "Vote now" : event.action;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="impact-sheet-title">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-stone-100 px-5 py-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">Impact</div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-stone-400"><X className="w-4 h-4 text-stone-500" /></button>
        </div>
        <div className="px-5 py-5">
          <h2 id="impact-sheet-title" className="font-bold text-2xl tracking-tight leading-tight mb-1">{event.title}</h2>
          <div className="text-sm text-stone-500 mb-5">{event.subtitle}</div>
          <div className="mb-5"><CouncilMemberBadge councilMember={councilMember} attribution={event.attribution} /></div>
          {event.impact.dollars && (
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-800 mb-2"><DollarSign className="w-3.5 h-3.5" aria-hidden="true" /> Dollars on the line</div>
              <div className="text-4xl font-black tracking-tight text-stone-900 mb-1">{event.impact.dollars}</div>
              <div className="text-sm text-stone-700 leading-relaxed">in capital funding decided by this vote</div>
            </div>
          )}
          <div className="space-y-3 mb-5">
            <div><div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2">What it affects</div>
              <div className="flex flex-wrap gap-1.5">{event.impact.areas.map((area) => <span key={area} className="text-xs font-medium bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full">{area}</span>)}</div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">Why this matters</div>
              <p className="text-sm text-stone-800 leading-relaxed">This {event.impact.text}.</p>
            </div>
            <div className="flex items-start gap-2 text-xs text-stone-500"><Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" /><span>Source: {event.sourceLabel}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={event.actionUrl} target="_blank" rel="noopener noreferrer" onClick={() => { onIntent(); onClose(); }} className="col-span-2 inline-flex items-center justify-center gap-1.5 bg-stone-900 text-white font-semibold text-sm px-4 py-3 rounded-xl hover:bg-stone-800 transition focus:outline-none focus:ring-2 focus:ring-amber-400">{actionLabel}<ArrowUpRight className="w-4 h-4" aria-hidden="true" /></a>
            <a href={toGCalLink(event)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 bg-white border border-stone-200 text-stone-700 font-medium text-xs px-3 py-2.5 rounded-xl hover:border-stone-300 transition focus:outline-none focus:ring-2 focus:ring-stone-400"><CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> Add to calendar</a>
            <button onClick={() => { if (navigator.share) navigator.share({ title: event.title, text: event.subtitle, url: event.actionUrl }); }} className="inline-flex items-center justify-center gap-1.5 bg-white border border-stone-200 text-stone-700 font-medium text-xs px-3 py-2.5 rounded-xl hover:border-stone-300 transition focus:outline-none focus:ring-2 focus:ring-stone-400"><Share2 className="w-3.5 h-3.5" aria-hidden="true" /> Share</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CouncilMemberSheet({ member, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-stone-100 px-5 py-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">{member.office ? `Your ${member.office}` : "Your Representative"}</div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-stone-400"><X className="w-4 h-4 text-stone-500" /></button>
        </div>
        <div className="px-5 py-5">
          <div className="flex items-center gap-4 mb-5">
            <CouncilPhoto member={member} size="lg" />
            <div className="min-w-0">
              <div className="font-bold text-xl leading-tight tracking-tight">{member.name}</div>
              <div className="text-sm text-stone-500">{member.jurisdictionLabel}{member.jurisdictionArea ? ` · ${member.jurisdictionArea}` : ""}</div>
            </div>
          </div>
          <div className="space-y-2 mb-5">
            <a href={`mailto:${member.email}`} className="flex items-center gap-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl px-4 py-3 transition focus:outline-none focus:ring-2 focus:ring-stone-400">
              <div className="w-9 h-9 rounded-lg bg-white border border-stone-200 flex items-center justify-center flex-shrink-0"><Mail className="w-4 h-4 text-stone-700" aria-hidden="true" /></div>
              <div className="flex-1 min-w-0"><div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Email</div><div className="text-sm font-medium truncate">{member.email}</div></div>
              <ArrowUpRight className="w-4 h-4 text-stone-400 flex-shrink-0" aria-hidden="true" />
            </a>
            <a href={`tel:${member.phone?.replace(/\D/g, "")}`} className="flex items-center gap-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl px-4 py-3 transition focus:outline-none focus:ring-2 focus:ring-stone-400">
              <div className="w-9 h-9 rounded-lg bg-white border border-stone-200 flex items-center justify-center flex-shrink-0"><Phone className="w-4 h-4 text-stone-700" aria-hidden="true" /></div>
              <div className="flex-1 min-w-0"><div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Office phone</div><div className="text-sm font-medium">{member.phone}</div></div>
              <ArrowUpRight className="w-4 h-4 text-stone-400 flex-shrink-0" aria-hidden="true" />
            </a>
            <a href={member.bio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl px-4 py-3 transition focus:outline-none focus:ring-2 focus:ring-stone-400">
              <div className="w-9 h-9 rounded-lg bg-white border border-stone-200 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-stone-700" aria-hidden="true" /></div>
              <div className="flex-1 min-w-0"><div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Full bio & voting record</div><div className="text-sm font-medium">{hostnameOf(member.bio)}</div></div>
              <ArrowUpRight className="w-4 h-4 text-stone-400 flex-shrink-0" aria-hidden="true" />
            </a>
          </div>
          <div className="flex items-start gap-2 text-xs text-stone-500"><Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" /><span>Photo and contact info are publicly listed at {hostnameOf(member.bio)}.</span></div>
        </div>
      </div>
    </div>
  );
}

function WhyWeAskSheet({ onClose, onOpenPrivacy }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-stone-100 px-5 py-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Why we ask</div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-stone-400"><X className="w-4 h-4 text-stone-500" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <h2 className="font-bold text-xl tracking-tight leading-tight">We ask so we can hide registration prompts.</h2>
          <p className="text-sm text-stone-700 leading-relaxed">
            If you're already registered, you don't need to see the big "Register to vote" cards — we can skip them and show you the election itself. That's the whole reason we ask.
          </p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 mb-1">What we keep</div>
            <ul className="text-xs text-emerald-900 space-y-1 leading-relaxed">
              <li>• Your ZIP code (so we can show events near you)</li>
              <li>• Your "I'm registered" toggle state</li>
              <li>• Which events you confirmed attending</li>
            </ul>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-800 mb-1">What we never ask for</div>
            <ul className="text-xs text-rose-900 space-y-1 leading-relaxed">
              <li>• Your full name, address, or date of birth</li>
              <li>• Your SSN or ID number</li>
              <li>• Who you voted for</li>
              <li>• Verification with the Board of Elections</li>
            </ul>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            We trust your self-attestation. If you say you're registered, we believe you. If the state's records disagree, you'll find out when you try to vote — not from us.
          </p>
          <button onClick={onOpenPrivacy} className="w-full text-sm font-semibold text-stone-900 border border-stone-300 rounded-xl py-2.5 hover:bg-stone-50 transition focus:outline-none focus:ring-2 focus:ring-stone-400">Read the full Privacy Policy</button>
        </div>
      </div>
    </div>
  );
}

function ReportMissingSheet({ onClose }) {
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-stone-100 px-5 py-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" aria-hidden="true" /> Report missing event</div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-stone-400"><X className="w-4 h-4 text-stone-500" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="w-7 h-7 text-emerald-700" aria-hidden="true" /></div>
              <div className="font-bold text-lg mb-1">Thanks for flagging it</div>
              <div className="text-sm text-stone-600 leading-relaxed">We'll review and add it if it checks out. The app is only as good as the data — your reports make it better.</div>
            </div>
          ) : (
            <>
              <h2 className="font-bold text-xl tracking-tight leading-tight">Spotted an event we missed?</h2>
              <p className="text-sm text-stone-700 leading-relaxed">Tell us about a public meeting, vote, or deadline that should be on here. We'll verify and add it.</p>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-stone-600 mb-1 block">Event name or description</span>
                  <input type="text" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" placeholder="e.g., Brooklyn CB14 Transportation Committee" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-stone-600 mb-1 block">Date (if known)</span>
                  <input type="date" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-stone-600 mb-1 block">Source link</span>
                  <input type="url" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" placeholder="https://..." />
                </label>
              </div>
              <button onClick={() => setSubmitted(true)} className="w-full bg-stone-900 text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-stone-800 transition focus:outline-none focus:ring-2 focus:ring-amber-400">Submit</button>
              <p className="text-[11px] text-stone-500 text-center">We read every report. Expect an update within a few days if you include your email.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TrustDocumentPage({ doc, onClose, t, lastUpdatedLabel }) {
  const content = {
    about: <AboutContent />,
    privacy: <PrivacyContent />,
    terms: <TermsContent />,
  }[doc];

  const title = { about: "About", privacy: "Privacy Policy", terms: "Terms of Service" }[doc];

  return (
    <div className="min-h-screen bg-white text-stone-900" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-stone-200 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} aria-label="Back" className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-stone-400"><ArrowLeft className="w-4 h-4 text-stone-700" /></button>
          <div>
            <div className="font-bold text-base tracking-tight">{title}</div>
            <div className="text-[11px] text-stone-500">On Your Block · Updated {lastUpdatedLabel}</div>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-10">
        {content}
        <div className="mt-12 pt-6 border-t border-stone-200 text-xs text-stone-500">
          <div>Questions? <a href="mailto:hello@onyourblock.nyc" className="underline hover:text-stone-800">hello@onyourblock.nyc</a> <span className="text-stone-400">(placeholder — not yet active)</span></div>
          <div className="mt-2">Version {APP_VERSION} · Data last updated {lastUpdatedLabel}</div>
        </div>
      </main>
    </div>
  );
}

function AboutContent() {
  return (
    <article className="prose prose-stone max-w-none">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-xs font-medium text-amber-800 mb-4">
          <Heart className="w-3 h-3" aria-hidden="true" />
          <span>A pamphlet, not an institution</span>
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-4 leading-tight">About On Your Block</h1>
        <p className="text-lg text-stone-700 leading-relaxed">New York is full of civic power that goes unused — not because people don't care, but because nobody tells them it's happening.</p>
      </div>

      <div className="space-y-8 text-stone-800 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold tracking-tight mb-3">The pamphlet at the farmers market</h2>
          <p className="mb-3">This started at a farmers market. There was a folding table with a printed pamphlet: "Vote this week on how to spend $1M in your district." Most people walked past. The few who stopped were surprised — surprised the vote existed, surprised they were allowed to participate, surprised at how much was at stake.</p>
          <p>The information was public. The vote was open. The barrier wasn't access; it was awareness. If you didn't already know to look, there was no way you'd find out in time.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight mb-3">What we do</h2>
          <p className="mb-3">On Your Block surfaces the civic actions happening in your neighborhood right now, in plain language, with a direct link to do the thing. Vote in participatory budgeting. Show up to a community board meeting. Register before the deadline. Speak at a CCRB hearing.</p>
          <p>No accounts required. No data sold. No political endorsements. The app points you at the door; you decide whether to walk through it.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight mb-3">Who we are</h2>
          <p className="mb-3"><strong>On Your Block Project.</strong> A small team of New Yorkers who got tired of missing things that mattered.</p>
          <p>Not a company, not a nonprofit (yet), not affiliated with any political party, campaign, advocacy group, or city agency. Not endorsed by the City of New York.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight mb-3">How we're funded</h2>
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-5">
            <p className="font-semibold text-stone-900 mb-2">Self-funded, not-for-profit, no outside funding at this time.</p>
            <p className="text-sm">If this ever changes — grants, sponsorships, donations — it will be disclosed here first, with the funder named. We believe a civic tool that hides its funding is not a civic tool.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight mb-3">Where our data comes from</h2>
          <p className="mb-3">All event data is sourced from official public sources:</p>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>NYC Council (council.nyc.gov) — participatory budgeting, council member directory</li>
            <li>NYC Board of Elections (vote.nyc) — elections, poll sites, registration deadlines</li>
            <li>NYS Board of Elections (elections.ny.gov) — state-level deadlines</li>
            <li>Individual Community Board websites (various nyc.gov subdomains)</li>
            <li>NYC Civilian Complaint Review Board (nyc.gov/ccrb)</li>
            <li>Manhattan, Brooklyn, Queens, Bronx, and Staten Island Borough Presidents' offices</li>
          </ul>
          <p className="mt-3 text-sm">Every event links directly back to its official source. When the source is ambiguous or the data might be stale, we say so.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight mb-3">What we don't do</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>We don't sell data. We collect almost none to begin with.</li>
            <li>We don't endorse candidates, parties, or ballot positions.</li>
            <li>We don't use dark patterns — no fake urgency, no guilt prompts, no manipulation.</li>
            <li>We don't verify your registration with the Board of Elections. We trust your self-report.</li>
            <li>We don't track you across other sites.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight mb-3">Help us get better</h2>
          <p>We miss events. Our scrapers break. Community boards redesign their websites without warning. If you spot something missing or wrong, <strong>tell us</strong> via the "Report missing event" button. The app is only as good as the data, and the data is only as good as the people watching it.</p>
        </section>
      </div>
    </article>
  );
}

function PrivacyContent() {
  return (
    <article className="prose prose-stone max-w-none">
      <h1 className="text-3xl font-black tracking-tight mb-3 leading-tight">Privacy Policy</h1>
      <p className="text-stone-600 mb-8">Plain English. Short. The short version: we collect almost nothing, and what little we collect stays on your device unless you explicitly send it to us.</p>

      <div className="space-y-8 text-stone-800 leading-relaxed text-[15px]">
        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">What we collect</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Your ZIP code</strong>, stored locally in your browser, so we can show you nearby events.</li>
            <li><strong>Your "I'm registered" toggle state</strong>, stored locally, so we don't keep asking you.</li>
            <li><strong>Which events you confirmed attending</strong>, stored locally, so your impact history persists.</li>
            <li><strong>Anonymous usage stats</strong> (page views, which features get used) — aggregated, no personal identifiers, no tracking cookies.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">What we don't collect</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>Your name, address, date of birth, or SSN</li>
            <li>Your email (unless you submit it via the "Report missing event" form, and even then only if you want a reply)</li>
            <li>Who you voted for or intend to vote for</li>
            <li>Your identity across sessions — we don't create user accounts</li>
            <li>Cross-site tracking data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Cookies and trackers</h2>
          <p>We use a single privacy-respecting analytics service that does not use cookies, does not track you across sites, and does not collect personal data. No Google Analytics. No Facebook pixel. No ad trackers.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Minors</h2>
          <p>NYC's Participatory Budgeting lets 11-year-olds vote, so this app is designed for use by minors. We comply with COPPA: we don't collect personal information from anyone, including minors. All stored data is anonymous and local to your device. If you are under 13 and wish to delete local data, clear your browser storage.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Push notifications</h2>
          <p>If you opt in to alerts, we request browser permission to send Web Push notifications. You can revoke this permission at any time in your browser settings. We send notifications only for events you've nudged.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Data deletion</h2>
          <p>All your data lives in your browser's local storage. Clearing your browser data deletes everything. If we later add server-side accounts, we'll update this policy and provide a one-click account deletion.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Third parties</h2>
          <p>We don't sell, rent, share, or trade your data with anyone. External links open to government sites (nyc.gov, vote.nyc, etc.) — those sites have their own privacy policies.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Changes to this policy</h2>
          <p>If we make material changes, we'll post the update with a visible "updated" date in the header. Significant changes will also be flagged in-app with a banner.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Your rights</h2>
          <p>Under California (CCPA/CPRA), New York (SHIELD Act), and GDPR, you have the right to access, correct, and delete your data. Since we don't collect personal data, access and deletion are immediate: clear your browser storage. For any other requests, email us.</p>
        </section>
      </div>
    </article>
  );
}

function TermsContent() {
  return (
    <article className="prose prose-stone max-w-none">
      <h1 className="text-3xl font-black tracking-tight mb-3 leading-tight">Terms of Service</h1>
      <p className="text-stone-600 mb-8">The short version: we're providing information; the authoritative source is always the linked .gov site. Don't abuse the service. We're not liable if things go wrong.</p>

      <div className="space-y-8 text-stone-800 leading-relaxed text-[15px]">
        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">What On Your Block is</h2>
          <p>A free, informational tool that aggregates public civic event data. We are not a government agency. We are not affiliated with or endorsed by the City of New York, any political party, campaign, or candidate.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Data accuracy</h2>
          <p>We work hard to keep event data accurate and current, but civic sources change, scrapers break, and meetings get rescheduled without notice. <strong>Always confirm critical details (dates, locations, deadlines) with the official source linked on each card before acting.</strong> If the app says a meeting is at 6:30pm and the community board's website says 7pm, the community board is right.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">No warranty</h2>
          <p>The service is provided "as is." We don't warrant that information is accurate, complete, or timely. We don't warrant uninterrupted service. Use your judgment.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Limitation of liability</h2>
          <p>If you miss a vote, show up to a meeting that moved, or otherwise experience consequences from stale or incorrect data, On Your Block Project and its contributors are not liable. We're a volunteer-run pamphlet, not a government service.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Acceptable use</h2>
          <p>Don't scrape, overload, or abuse the service. Don't submit false information to the "Report missing event" form. Don't use the service to harass public officials or other users. Don't use the service to coordinate illegal activity.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Your content</h2>
          <p>If you submit event reports or other content, you grant us a limited license to use that content to improve the service. We won't sell it or publish it with your identity attached.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Governing law</h2>
          <p>These terms are governed by the laws of the State of New York. Disputes will be resolved in New York state courts.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight mb-2">Changes</h2>
          <p>We may update these terms. Material changes will be flagged in-app. Continued use after changes constitutes acceptance.</p>
        </section>
      </div>
    </article>
  );
}

function EmptyState({ t }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
      <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-3"><Calendar className="w-5 h-5 text-stone-400" aria-hidden="true" /></div>
      <div className="font-semibold text-stone-700 mb-1">{t.pageNotFound}</div>
      <div className="text-sm text-stone-500">Try clearing filters or changing your ZIP code.</div>
    </div>
  );
}
