export const statuses = [
  "Saved",
  "Applied",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
  "Withdrawn",
];
export const uid = () => crypto.randomUUID();
export function blankWorkspace() {
  return {
    applications: [],
    completed: [],
    companies: [],
    goals: [],
    milestones: [],
    tasks: [],
    profile: { display_name: "", title: "", country: "", age_band: "" },
    preferences: {
      saveCoachHistory: false,
      emailReminders: false,
      onboarded: false,
    },
    aiHistory: [],
    revision: 0,
  };
}
export function text(value, max = 200) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}
export function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}
export function validateJobResults(jobs) {
  const invalid = () =>
    new Error(
      "The job source returned invalid listings. Please try again later.",
    );
  if (!Array.isArray(jobs) || jobs.length > 100) throw invalid();
  return jobs.map((job) => {
    if (
      !job ||
      !["string", "number"].includes(typeof job.id) ||
      !String(job.id).trim() ||
      typeof job.title !== "string" ||
      !job.title.trim() ||
      typeof job.company !== "string" ||
      !job.company.trim()
    )
      throw invalid();
    let link;
    try {
      link = new URL(job.url);
    } catch {
      throw invalid();
    }
    if (
      link.protocol !== "https:" ||
      link.username ||
      link.password ||
      link.href.length > 2048
    )
      throw invalid();
    for (const key of [
      "location",
      "salary",
      "postedAt",
      "source",
      "category",
      "descriptionText",
      "employmentType",
      "arrangement",
    ])
      if (job[key] != null && typeof job[key] !== "string") throw invalid();
    if (
      job.tags != null &&
      (!Array.isArray(job.tags) ||
        job.tags.some((tag) => typeof tag !== "string"))
    )
      throw invalid();
    return {
      id: String(job.id).slice(0, 200),
      title: job.title.trim().slice(0, 200),
      company: job.company.trim().slice(0, 120),
      url: link.href,
      location: (job.location || "").slice(0, 200),
      salary: (job.salary || "").slice(0, 200),
      postedAt: (job.postedAt || "").slice(0, 50),
      source: (job.source || "Remotive").slice(0, 80),
      tags: (job.tags || []).slice(0, 20).map((tag) => tag.slice(0, 60)),
      descriptionText: (job.descriptionText || "").slice(0, 24000),
      descriptionTruncated: job.descriptionTruncated === true || (job.descriptionText || "").length > 24000,
      category: (job.category || "").slice(0, 100),
      employmentType: (job.employmentType || "").slice(0, 60),
      arrangement: ["Remote", "Hybrid", "On-site"].includes(job.arrangement)
        ? job.arrangement
        : "",
    };
  });
}
export function validateApplication(a) {
  if (!a.company?.trim() || !a.role?.trim() || !a.country?.trim())
    throw new Error("Company, position and country are required.");
  if (!statuses.includes(a.status))
    throw new Error("Choose a valid application status.");
  const min =
      a.salaryMin === "" || a.salaryMin == null ? null : Number(a.salaryMin),
    max =
      a.salaryMax === "" || a.salaryMax == null ? null : Number(a.salaryMax);
  if (
    [min, max].some(
      (n) => n !== null && (!Number.isFinite(n) || n < 0 || n > 1e9),
    ) ||
    (min !== null && max !== null && min > max)
  )
    throw new Error(
      "Enter a valid salary range with the minimum no higher than the maximum.",
    );
  if (a.url && !safeUrl(a.url))
    throw new Error("Use an https:// or http:// job posting link.");
  return { ...a, salaryMin: min, salaryMax: max };
}
export function analytics(workspace, now = new Date()) {
  const apps = workspace.applications;
  const groups = (key) =>
    Object.entries(
      apps.reduce((all, a) => {
        const k = a[key] || "Not specified";
        all[k] = (all[k] || 0) + 1;
        return all;
      }, Object.create(null)),
    ).sort((a, b) => b[1] - a[1]);
  const submitted = apps.filter(
    (a) =>
      a.applicationDate ||
      [
        "Applied",
        "Interview",
        "Offer",
        "Hired",
        "Rejected",
        "Withdrawn",
      ].includes(a.status),
  ).length;
  const responses = apps.filter((a) =>
    ["Interview", "Offer", "Hired", "Rejected"].includes(a.status),
  ).length;
  const monthly = {};
  for (const a of apps) {
    const value = a.applicationDate || a.createdAt;
    if (value && /^\d{4}-\d{2}/.test(value)) {
      const key = value.slice(0, 7);
      monthly[key] = (monthly[key] || 0) + 1;
    }
  }
  return {
    total: apps.length,
    submitted,
    interviews: apps.filter((a) => a.interviewAt).length,
    offers: apps.filter((a) => ["Offer", "Hired"].includes(a.status)).length,
    responseRate: submitted ? Math.round((responses / submitted) * 100) : 0,
    deadlines: apps.filter(
      (a) =>
        a.deadline &&
        !["Rejected", "Withdrawn", "Hired", "Offer"].includes(a.status) &&
        Date.parse(a.deadline + "T23:59:59") >= now.getTime() &&
        Date.parse(a.deadline + "T00:00:00") <= now.getTime() + 14 * 86400000,
    ).length,
    statuses: groups("status"),
    countries: groups("country"),
    companies: groups("company"),
    monthly: Object.entries(monthly).sort(),
    roadmap: workspace.milestones.length
      ? Math.round(
          (workspace.milestones.filter((m) => m.completed).length /
            workspace.milestones.length) *
            100,
        )
      : 0,
  };
}
export function reminders(workspace, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = 86400000;
  const result = [];
  const add = (id, kind, title, value, complete = false) => {
    if (!value || complete) return;
    const date = new Date(value.length === 10 ? value + "T12:00:00" : value);
    if (!Number.isFinite(date.getTime())) return;
    const delta = Math.floor((date - today) / day);
    if (delta <= 7)
      result.push({ id, kind, title, date: value, overdue: delta < 0 });
  };
  for (const a of workspace.applications) {
    if (["Rejected", "Withdrawn", "Hired"].includes(a.status)) continue;
    add(a.id + "deadline", "Deadline", `${a.company} · ${a.role}`, a.deadline);
    add(
      a.id + "interview",
      "Interview",
      `${a.company} · ${a.role}`,
      a.interviewAt,
    );
    add(a.id + "followup", "Follow-up", a.company, a.followUp);
  }
  for (const t of workspace.tasks)
    add(t.id, "Task", t.title, t.dueDate, t.completed);
  for (const m of workspace.milestones)
    add(m.id, "Milestone", m.title, m.targetDate, m.completed);
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
export function starterRoadmap(goal, now = new Date()) {
  const role = text(goal.targetRole || goal.title || "your target role", 100);
  const skills = (goal.skills || []).slice(0, 12);
  return [
    { title: `Define the requirements for ${role}`, kind: "Weekly", weeks: 1 },
    {
      title: `Practice ${skills.length ? skills.join(", ") : "the core skills for " + role}`,
      kind: "Course",
      weeks: 2,
    },
    {
      title: `Build a portfolio project for ${role}`,
      kind: "Project",
      weeks: 4,
    },
    {
      title: "Review your resume and practice an interview",
      kind: "Weekly",
      weeks: 5,
    },
    {
      title: "Research employers and submit tailored applications",
      kind: "Monthly",
      weeks: 6,
    },
  ].map((m) => ({
    id: uid(),
    title: m.title,
    kind: m.kind,
    targetDate: new Date(now.getTime() + m.weeks * 7 * 86400000)
      .toISOString()
      .slice(0, 10),
    completed: false,
    notes: "Editable starter plan, not an AI-generated recommendation.",
  }));
}
export function backupPayload(workspace) {
  return {
    app: "launchpad",
    formatVersion: 1,
    workspaceVersion: 4,
    savedAt: new Date().toISOString(),
    applications: workspace.applications,
    completed: workspace.completed,
    extras: {
      companies: workspace.companies,
      goals: workspace.goals,
      milestones: workspace.milestones,
      tasks: workspace.tasks,
      profile: workspace.profile,
      preferences: workspace.preferences,
    },
    aiHistory: workspace.aiHistory,
  };
}
