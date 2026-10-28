import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateJobResults,
  analytics,
  blankWorkspace,
} from "../lib/model.mjs";
import {
  filterJobs,
  bookmarkedJobs,
  reportedArrangement,
  BOOKMARK_LIMIT,
} from "../lib/job-discovery.mjs";
const rows = validateJobResults([
  {
    id: "one",
    title: "Senior Frontend Engineer",
    company: "Fixture employer",
    location: "Worldwide",
    salary: "USD 80,000–110,000 per year",
    category: "Software Development",
    employmentType: "full_time",
    arrangement: "Remote",
    postedAt: "2026-10-01",
    tags: ["JavaScript"],
    url: "https://remotive.com/remote-jobs/one",
  },
  {
    id: "two",
    title: "Junior Designer",
    company: "Another fixture",
    location: "Canada",
    tags: ["Figma"],
    url: "https://remotive.com/remote-jobs/two",
  },
]);
test("job filtering preserves source salary text and supports reported categories without guessing missing fields", () => {
  const found = filterJobs(rows, {
    title: "frontend",
    company: "fixture",
    country: "Canada",
    stack: " JavaScript ",
    experience: "senior",
    category: "Software Development",
    arrangement: "Remote",
    salary: true,
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].salary, "USD 80,000–110,000 per year");
  assert.equal(filterJobs(rows, { category: "Invented area" }).length, 0);
  assert.equal(filterJobs(rows, { arrangement: "Hybrid" }).length, 0);
  assert.equal(rows[1].salary, "");
  assert.equal(rows[1].category, "");
  assert.equal(
    reportedArrangement({ ...rows[1], source: "Other source" }),
    "Not supplied",
  );
});
test("job bookmarks deduplicate safely and ignore invalid imported links within a bounded preference payload", () => {
  const saved = bookmarkedJobs({
    savedJobs: [
      rows[0],
      rows[0],
      { ...rows[1], url: "javascript:alert(1)" },
      rows[1],
    ],
  });
  assert.equal(saved.length, 2);
  assert.equal(
    bookmarkedJobs({ savedJobs: Array(100).fill(rows[0]) }).length,
    1,
  );
  assert.equal(BOOKMARK_LIMIT, 10);
  assert.throws(
    () =>
      validateJobResults([
        { ...rows[0], url: "https://example.com/" + "x".repeat(2100) },
      ]),
    /invalid listings/,
  );
});
test("analytics counts literal prototype-like company names as real user records", () => {
  const data = blankWorkspace();
  data.applications = [
    { company: "__proto__", status: "Saved", country: "constructor" },
    { company: "__proto__", status: "Applied", country: "constructor" },
  ];
  const result = analytics(data);
  assert.deepEqual(result.companies, [["__proto__", 2]]);
  assert.deepEqual(result.countries, [["constructor", 2]]);
});

test("valid restored bookmarks above the new-entry cap remain readable rather than being truncated", () => {
  const imported = Array.from({ length: 12 }, (_, i) => ({
    ...rows[0],
    id: "restored-" + i,
  }));
  assert.equal(bookmarkedJobs({ savedJobs: imported }).length, 12);
});
