import { readStudio } from "./career-studio.mjs";
import {
  applicationSchedule,
  applicationHistory,
} from "./workspace-insights.mjs";
export function careerNextStep(data, now = new Date()) {
  const event = upcomingCommitments(data.applications || [], now)[0];
  if (event)
    return {
      title: `Prepare for your ${event.kind.toLowerCase()}`,
      detail: `${event.company} · ${event.role} · ${event.date}`,
      view: "applications",
      source: "Your saved application dates",
    };
  const milestone = (data.milestones || [])
    .filter((m) => !m.completed)
    .sort((a, b) =>
      (a.targetDate || "9999").localeCompare(b.targetDate || "9999"),
    )[0];
  if (milestone)
    return {
      title: milestone.title,
      detail: milestone.targetDate
        ? "Target date: " + milestone.targetDate
        : "Give this milestone a realistic target date.",
      view: "roadmap",
      source: "Your next incomplete personal milestone",
    };
  let studio;
  try {
    studio = readStudio(data.preferences);
  } catch {
    studio = { resumes: [], practices: [] };
  }
  if (!studio.resumes.length)
    return {
      title: "Build a resume from your own work",
      detail:
        "Start with your actual skills, education and portfolio projects.",
      view: "resume",
      source: "No saved resume version yet",
    };
  if (!studio.practices.length)
    return {
      title: "Practice your project introduction",
      detail:
        "Choose a static question in Interview Lab and save your own answer.",
      view: "interview",
      source: "No saved practice exercise yet",
    };
  if (!(data.goals || []).length)
    return {
      title: "Give your next chapter a direction",
      detail: "Create a personal career goal before choosing your next step.",
      view: "roadmap",
      source: "No saved career goal yet",
    };
  return {
    title: "Review opportunities with intent",
    detail:
      "Compare source requirements with your declared skills. No application will be sent automatically.",
    view: "jobs",
    source: "Your career preparation tools are ready to use",
  };
}
export function careerActivity(data) {
  let studio;
  try {
    studio = readStudio(data.preferences);
  } catch {
    studio = { resumes: [], practices: [] };
  }
  const rows = [];
  for (const a of data.applications || [])
    for (const h of applicationHistory(a.updates))
      rows.push({
        at: h.at,
        title: a.company + " · " + h.summary,
        view: "applications",
      });
  for (const r of studio.resumes)
    if (r.updatedAt)
      rows.push({
        at: r.updatedAt,
        title: "Resume saved · " + r.label,
        view: "resume",
      });
  for (const p of studio.practices)
    rows.push({
      at: p.updatedAt,
      title: "Interview practice saved",
      view: "interview",
    });
  return rows
    .filter((r) => Number.isFinite(Date.parse(r.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 6);
}

// Day-only deadlines remain actionable through that local day. Explicit interview
// times are compared to now so an earlier interview today is not called upcoming.
export function upcomingCommitments(applications, now = new Date()) {
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return applicationSchedule(applications).filter(
    (e) =>
      e.date >= day &&
      !(
        e.kind === "Interview" &&
        e.value.includes("T") &&
        new Date(e.value).getTime() < now.getTime()
      ),
  );
}
