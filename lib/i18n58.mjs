// Incremental message catalog. English ships; future dictionaries fall back safely.
export const en58 = Object.freeze({
  arrangementAll: "Any reported arrangement",
  arrangementRemote: "Remote",
  arrangementHybrid: "Hybrid",
  arrangementOnsite: "On-site",

  resumeKicker: "SAVED RESUME CHECKLIST",
  sourceKicker: "RETRIEVED SOURCE DATA",
  demoKicker: "DEMO",
  loading: "Loading this workspace…",
  coachIntro:
    "Generative assistance through a secure backend, when configured. A separate product tour contains labelled scripted examples only.",

  readinessDetails: "Review the seven-field checklist",
  readiness: "Your preparation, at a glance.",
  readinessCopy:
    "A checklist of saved resume fields, not an ATS score or a hiring prediction.",
  noResume: "No saved resume yet. Build a version from your actual work.",
  resumeFields: "{filled} of {total} fields present",
  resumeOpen: "Open Resume Studio",
  recommendations: "Opportunities to consider",
  recommendedCopy:
    "Retrieved listings ordered by recognized skill overlap with your saved resumes and goals. No fit score or hiring prediction.",
  noJobs:
    "Search Jobs to retrieve actual opportunities. No example vacancies are included here.",
  openJobs: "Explore sourced jobs",
  matches: "{count} recognized skill terms in common",
  noMatch: "No recognized skill overlap; review the original requirements.",
  recent: "Recently viewed · this session",
  recentCopy:
    "Up to 12 sourced listings in memory only. Cleared on reload or workspace change; never synchronized to your account. Availability must be verified at the original source.",
  recentEmpty:
    "Open a retrieved or bookmarked listing to begin. Viewing a job does not apply for it.",
  clearRecent: "Clear viewed history",
  historyCleared: "Session job history cleared.",
  viewDetails: "View details",
  comparison: "Prepare resume-to-job comparison",
  comparisonHelp:
    "Copies selected saved fields into the Coach composer only after confirmation. It does not call AI, upload contact fields or spend credits.",
  compareConsent:
    "Copy the first saved resume’s headline, summary, skills and project descriptions, plus this source listing excerpt, into AI Coach? Review the text before sending. No email, phone or name field is copied. AI is not contacted until you choose Ask coach.",
  comparisonMissing: "Save a resume version before preparing a comparison.",
  comparisonPrepared:
    "Draft comparison prepared. Review the personal content and provider availability before sending.",
  tourJobs: "Preview job search demo",
  tourAI: "Preview assistant demo",
  demoTitle: "Product tour — scripted demo",
  demoNotice:
    "DEMO ONLY · illustrative content, not a live vacancy or generated AI response. Nothing here is saved to your workspace or sent to a provider.",
  demoJobsTitle: "Illustrative frontend role",
  demoJobsCompany: "Example employer · not a real vacancy",
  demoJobsCopy:
    "A source card would show the supplied location, salary, date and requirements. Unavailable facts remain unavailable.",
  demoApply: "Application disabled — no real vacancy",
  demoQuestion: "Example question: How can I prepare for a frontend interview?",
  demoAnswer:
    "Scripted example, not AI: pick a real project, explain one technical trade-off, and practise your answer aloud. A configured provider can personalize guidance after authentication, consent and quota checks.",
  closeDemo: "Close demo",
  openTour:
    "This preview is separate from live services and private workspace data.",
  name: "Name",
  headline: "Professional headline",
  summary: "Summary",
  skills: "Skills",
  languages: "Languages",
  evidence: "Experience, education or a project",
  contact: "At least one contact or portfolio link (optional to share)",
  privacy:
    "Only saved fields are checked; an empty field does not mean you are unqualified. Do not add sensitive information just to complete this checklist.",
  notSupplied: "Not supplied",
  avatarTitle: "Your profile identity",
  avatarCopy:
    "Initials are generated locally from your display name. No photo is uploaded or sent to an avatar service.",
  salaryUnchanged:
    "Salary stays in the source currency and wording. No conversion or estimated salary is invented.",
});
export function translator58(locale = "en", dictionaries = {}) {
  const dict = dictionaries[locale] || en58;
  return (key, values = {}) => {
    const text = dict[key] ?? en58[key];
    if (typeof text !== "string")
      throw Error("Unknown interface message: " + key);
    return text.replace(/\{(\w+)\}/g, (_, name) =>
      String(values[name] ?? "{" + name + "}"),
    );
  };
}
export const t58 = translator58();
export function formatDate58(value, locale = "en") {
  if (typeof value === "string") {
    const day = value.slice(0, 10),
      parsed = new Date(day + "T12:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}/.test(value) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== day
    )
      return t58("notSupplied");
  }
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date)
    : t58("notSupplied");
}
export function formatMoney58(value, currency = "USD", locale = "en") {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !/^[A-Z]{3}$/.test(currency)
  )
    return t58("notSupplied");
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return t58("notSupplied");
  }
}
