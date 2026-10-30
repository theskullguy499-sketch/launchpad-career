// Presentation-only aggregates and bounded preferences. Never grants account rights.
export function momentumSeries(applications, now = new Date()) {
  const rows = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      count: 0,
    };
  });
  for (const app of applications || []) {
    const date = app.applicationDate;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const parsed = new Date(date + "T12:00:00Z");
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      continue;
    const row = rows.find((r) => r.month === date.slice(0, 7));
    if (row) row.count++;
  }
  return rows;
}
export function interviewSnapshot(applications = []) {
  const submitted = applications.filter((a) =>
    [
      "Applied",
      "Interview",
      "Offer",
      "Hired",
      "Rejected",
      "Withdrawn",
    ].includes(a.status),
  );
  const reached = submitted.filter((a) =>
    ["Interview", "Offer", "Hired"].includes(a.status),
  );
  return {
    submitted: submitted.length,
    reached: reached.length,
    percent: submitted.length
      ? Math.round((reached.length * 100) / submitted.length)
      : null,
  };
}
export const preferenceFields57 = [
  ["countries", "Preferred countries or regions", 400],
  ["jobTypes", "Preferred roles and job types", 400],
  ["arrangement", "Work arrangement preferences", 200],
  ["skills", "Technology skills", 800],
  ["languages", "Languages and self-declared level", 400],
  ["experience", "Experience and career context", 1000],
];
export function careerPreferences57(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Career preferences must be an object.");
  const result = {};
  for (const [key, , max] of preferenceFields57) {
    const raw = value?.[key] ?? "";
    if (typeof raw !== "string" || raw.length > max)
      throw Error(`Keep ${key} within ${max} characters.`);
    result[key] = raw.trim();
  }
  return result;
}
export function saveCareerPreferences57(preferences, value) {
  const result = {
    ...preferences,
    careerPreferences57: {
      ...preferences.careerPreferences57,
      ...careerPreferences57(value),
    },
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 45000)
    throw Error(
      "Workspace settings are full. Export a backup and shorten unused material. Nothing was saved.",
    );
  return result;
}
