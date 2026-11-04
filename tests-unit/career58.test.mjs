import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resumeReadiness58,
  viewedJobs58,
  recommendJobs58,
  comparisonPrompt58,
  initials58,
} from "../lib/career58.mjs";
import {
  t58,
  translator58,
  formatDate58,
  formatMoney58,
} from "../lib/i18n58.mjs";
const job = {
  id: "a",
  title: "Frontend role",
  company: "Source fixture",
  url: "https://example.com/job",
  source: "Remotive",
  tags: ["React", "JavaScript"],
  location: "Worldwide",
  descriptionText: "React development",
};
const resume = {
  name: "Person",
  title: "Frontend",
  email: "private@example.com",
  phone: "PRIVATE_PHONE",
  summary: "Own summary",
  skills: "JavaScript",
  languages: "English",
  projects: [{ heading: "Own project", description: "Original work" }],
};
test("readiness describes saved fields, never ATS quality or a hiring score", () => {
  assert.deepEqual(resumeReadiness58(null), []);
  assert.equal(resumeReadiness58(resume).filter((c) => c.present).length, 7);
  assert.equal(resumeReadiness58({}).filter((c) => c.present).length, 0);
});
test("session history validates source URLs, caps entries, deduplicates and bounds descriptions", () => {
  let rows = [];
  for (let i = 0; i < 15; i++)
    rows = viewedJobs58(rows, {
      ...job,
      id: String(i),
      descriptionText: "界".repeat(3000),
    });
  assert.equal(rows.length, 12);
  rows = viewedJobs58(rows, { ...job, id: "9" });
  assert.equal(rows[0].id, "9");
  assert.equal(rows.filter((j) => j.id === "9").length, 1);
  assert.throws(() =>
    viewedJobs58(rows, { ...job, url: "javascript:alert(1)" }),
  );
  assert.ok(new TextEncoder().encode(rows[1].descriptionText).length <= 1200);
});
test("recommendations rank only actual supplied listings using declared skill overlap", () => {
  const data = { preferences: {}, goals: [{ skills: "JavaScript" }] };
  const original = [
    {
      ...job,
      id: "python",
      tags: ["Python"],
      title: "Python",
      descriptionText: "Python",
    },
    { ...job, id: "js" },
  ];
  const ranked = recommendJobs58(original, data);
  assert.equal(ranked[0].job.id, "js");
  assert.equal(original[0].id, "python");
  assert.deepEqual(recommendJobs58([], data), []);
});
test("comparison is bounded, excludes contact/name fields and never fabricates qualifications", () => {
  const prompt = comparisonPrompt58(
    { ...resume, name: "PRIVATE_NAME", summary: "x".repeat(6000) },
    job,
  );
  assert.ok(prompt.length < 6000);
  assert.ok(!prompt.includes("PRIVATE_NAME"));
  assert.ok(!prompt.includes("private@example.com"));
  assert.ok(!prompt.includes("PRIVATE_PHONE"));
  assert.match(prompt, /Do not assign a hiring probability/);
  assert.throws(() => comparisonPrompt58(null, job));
});
test("new messages fall back to English and formatters reject unavailable financial/date values", () => {
  assert.equal(translator58("pt")("recent"), t58("recent"));
  assert.equal(
    translator58("es", { es: { recent: "Recientes" } })("recent"),
    "Recientes",
  );
  assert.throws(() => t58("missingKey"));
  assert.match(formatMoney58(9, "USD"), /9\.00/);
  assert.equal(formatMoney58("9", "USD"), "Not supplied");
  assert.equal(formatDate58("invalid"), "Not supplied");
  assert.equal(initials58("Álex Morgan"), "ÁM");
  assert.equal(initials58(""), "LP");
});
test("impossible or ambiguous source dates stay unavailable instead of normalizing to another date", () => {
  for (const value of ["2026-02-30", "2026-04-31", "03/04/2026"])
    assert.equal(formatDate58(value), "Not supplied");
  assert.notEqual(formatDate58("2026-02-28"), "Not supplied");
});
test("international comparison excerpts fit the byte-limited backend even with JSON escapes", () => {
  const prompt = comparisonPrompt58(
    { ...resume, summary: '界"\\'.repeat(2000) },
    { ...job, descriptionText: '界"\\'.repeat(4000) },
  );
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      expected_user: "00000000-0000-0000-0000-000000000001",
      prompt,
      intent: "advice",
      consent: {
        profile: false,
        goals: false,
        progress: false,
        history: false,
        historyContext: false,
      },
    }),
  ).length;
  assert.ok(bytes < 12000);
  assert.ok(prompt.length < 6000);
});
