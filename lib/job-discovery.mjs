import { validateJobResults } from "./model.mjs";
export const JOB_PAGE_SIZE = 12;
export const BOOKMARK_LIMIT = 10;
export const jobKey = (job) => `${job.source || "Remotive"}:${job.id}`;
export const reportedArrangement = (job) =>
  job.arrangement || (job.source === "Remotive" ? "Remote" : "Not supplied");
export function bookmarkedJobs(preferences) {
  const rows = Array.isArray(preferences?.savedJobs)
    ? preferences.savedJobs
    : [];
  const unique = new Map();
  for (const row of rows.slice(0, 100)) {
    try {
      const job = validateJobResults([row])[0];
      unique.set(jobKey(job), job);
    } catch {}
  }
  return [...unique.values()];
}
export function filterJobs(jobs, filters) {
  const query = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  const freeText = query(filters.query);
  const title = query(filters.title),
    company = query(filters.company),
    country = query(filters.country),
    stack = query(filters.stack),
    experience = query(filters.experience);
  const rows = jobs.filter(
    (job) =>
      query(
        job.title +
          " " +
          job.company +
          " " +
          job.tags.join(" ") +
          " " +
          job.category,
      ).includes(freeText) &&
      (!filters.employmentType ||
        job.employmentType === filters.employmentType) &&
      query(job.title).includes(title) &&
      query(job.company).includes(company) &&
      (!country ||
        query(job.location).includes(country) ||
        /worldwide|anywhere/i.test(job.location)) &&
      query(job.title + " " + job.tags.join(" ")).includes(stack) &&
      query(job.title).includes(experience) &&
      (!filters.salary || !!job.salary) &&
      (!filters.category || job.category === filters.category) &&
      (!filters.arrangement ||
        reportedArrangement(job) === filters.arrangement),
  );
  if (filters.sort === "newest")
    rows.sort(
      (a, b) => (Date.parse(b.postedAt) || 0) - (Date.parse(a.postedAt) || 0),
    );
  if (filters.sort === "company")
    rows.sort((a, b) => a.company.localeCompare(b.company));
  return rows;
}

// A full provider description must not fill the 50 KB RLS-protected preference row.
export function bookmarkRecord(job) {
  const record = structuredClone(job);
  const encoder = new TextEncoder();
  let text = "",
    bytes = 0;
  for (const character of record.descriptionText || "") {
    bytes += encoder.encode(character).length;
    if (bytes > 1200) break;
    text += character;
  }
  record.descriptionTruncated =
    record.descriptionTruncated ||
    text.length < (record.descriptionText || "").length;
  record.descriptionText = text;
  return record;
}
export function assertBookmarkBudget(preferences) {
  if (new TextEncoder().encode(JSON.stringify(preferences)).length > 44000)
    throw new Error(
      "Bookmark storage is full. Export a backup or remove a saved listing before adding another. Existing data is unchanged.",
    );
}
