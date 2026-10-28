function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
// Read-only projections and user-owned history. These never authorize cloud access.
export function applicationHistory(value) {
  return Array.isArray(value)
    ? value
        .filter(
          (x) =>
            x &&
            typeof x.at === "string" &&
            x.at.length <= 40 &&
            Number.isFinite(Date.parse(x.at)) &&
            typeof x.summary === "string",
        )
        .slice(-20)
        .map((x) => ({
          at: x.at,
          summary: x.summary.slice(0, 240),
          type: ["created", "status", "edited"].includes(x.type)
            ? x.type
            : "edited",
        }))
    : [];
}
export function recordApplicationUpdate(before, after, now = new Date()) {
  const fields = [
    "company",
    "role",
    "country",
    "location",
    "arrangement",
    "salaryMin",
    "salaryMax",
    "currency",
    "salaryPeriod",
    "applicationDate",
    "deadline",
    "priority",
    "notes",
    "interviewAt",
    "followUp",
    "url",
    "status",
  ];
  const changed = fields.filter(
    (k) => String(before?.[k] ?? "") !== String(after[k] ?? ""),
  );
  if (before && !changed.length) return after;
  const type = !before
    ? "created"
    : changed.includes("status")
      ? "status"
      : "edited";
  const summary = !before
    ? "Opportunity created"
    : type === "status"
      ? `Status: ${before.status} → ${after.status}${changed.length > 1 ? " · details updated" : ""}`
      : "Updated: " + changed.join(", ");
  return {
    ...after,
    updatedAt: now.toISOString(),
    updates: [
      ...applicationHistory(before?.updates),
      { at: now.toISOString(), type, summary },
    ].slice(-20),
  };
}
export function applicationSchedule(applications) {
  const result = [];
  for (const app of applications) {
    if (["Rejected", "Withdrawn", "Hired"].includes(app.status)) continue;
    for (const [key, kind] of [
      ["interviewAt", "Interview"],
      ["deadline", "Deadline"],
      ["followUp", "Follow-up"],
    ]) {
      const date = String(app[key] || "");
      if (
        !validDay(date.slice(0, 10)) ||
        !Number.isFinite(
          Date.parse(date.length === 10 ? date + "T12:00:00" : date),
        )
      )
        continue;
      result.push({
        id: app.id,
        date: date.slice(0, 10),
        value: date,
        kind,
        company: app.company,
        role: app.role,
      });
    }
  }
  return result.sort((a, b) => a.value.localeCompare(b.value));
}
export function nextApplicationAction(app, now = new Date()) {
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const dates = applicationSchedule([app]);
  const upcoming = dates.find((x) => x.date >= day),
    overdue = dates.at(-1);
  const item = upcoming || overdue;
  return item
    ? `${!upcoming ? "Overdue · " : ""}${item.kind} · ${item.date}`
    : "Set your next action";
}
export function periodApplications(applications, period, now = new Date()) {
  if (period === "all") return applications;
  const days = { 30: 30, 90: 90, 365: 365 }[period];
  if (!days) return applications;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return applications.filter((app) => {
    if (!validDay(app.applicationDate)) return false;
    const date = new Date(app.applicationDate + "T12:00:00");
    return date >= start && date <= end;
  });
}
export function datedMonths(applications) {
  const months = new Map();
  for (const app of applications)
    if (validDay(app.applicationDate)) {
      const month = app.applicationDate.slice(0, 7);
      months.set(month, (months.get(month) || 0) + 1);
    }
  return [...months].sort(([a], [b]) => a.localeCompare(b));
}
export function safeCompanyLink(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
