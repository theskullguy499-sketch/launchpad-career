import { test } from "node:test";
import assert from "node:assert/strict";
import { providerDescription } from "../supabase/functions/_shared/job-text.mjs";
import { normalizeJobs } from "../supabase/functions/_shared/handlers.mjs";
import { validateJobResults } from "../lib/model.mjs";
import {
  filterJobs,
  bookmarkRecord,
  assertBookmarkBudget,
} from "../lib/job-discovery.mjs";
const base = {
  id: "source-53",
  title: "Frontend Engineer",
  company: "Example",
  url: "https://remotive.com/remote-jobs/example",
  source: "Remotive",
  tags: ["React"],
  employmentType: "full_time",
};
test("provider description preserves source paragraphs and list text without active HTML", () => {
  const result = providerDescription(
    '<h2>Requirements</h2><p>React &amp; TypeScript &#x1F680;</p><ul><li>Write tests</li></ul><script>secret()</script><style>.x{}</style><img src="https://evil.invalid/tracker" onerror="alert(1)">',
  );
  assert.equal(
    result.descriptionText,
    "Requirements\n\nReact & TypeScript 🚀\n\n• Write tests",
  );
  assert.doesNotMatch(result.descriptionText, /secret|alert|<img|evil.invalid/);
  assert.equal(result.descriptionTruncated, false);
  assert.equal(providerDescription(null).descriptionText, "");
  assert.equal(
    providerDescription("&lt;script&gt;literal&lt;/script&gt;").descriptionText,
    "<script>literal</script>",
  );
});
test("real adapter and browser model retain bounded inert description fields, dropping unknown HTML", () => {
  const [job] = normalizeJobs({
    jobs: [
      {
        id: 53,
        title: base.title,
        company_name: base.company,
        url: base.url,
        description: "<p>Actual provider content.</p>",
        job_type: "full_time",
      },
    ],
  });
  const valid = validateJobResults([
    { ...job, description: "<iframe>ignored</iframe>" },
  ])[0];
  assert.equal(valid.descriptionText, "Actual provider content.");
  assert.equal(valid.employmentType, "full_time");
  assert.equal(valid.description, undefined);
  assert.throws(
    () => validateJobResults([{ ...base, descriptionText: {} }]),
    /invalid listings/,
  );
  assert.equal(
    providerDescription("x".repeat(25000)).descriptionText.length,
    24000,
  );
  assert.equal(
    providerDescription("x".repeat(25000)).descriptionTruncated,
    true,
  );
});
test("bookmark excerpts respect UTF-8 budget, retain original listing and do not mutate live descriptions", () => {
  const original = { ...base, descriptionText: "🚀".repeat(7000) };
  const saved = bookmarkRecord(original);
  assert.equal(original.descriptionText.length, 14000);
  assert.ok(new TextEncoder().encode(saved.descriptionText).length <= 1200);
  assert.equal(saved.descriptionTruncated, true);
  assert.equal(saved.url, original.url);
  assertBookmarkBudget({
    savedJobs: Array.from({ length: 10 }, (_, i) => ({
      ...saved,
      id: String(i),
    })),
  });
  assert.throws(
    () => assertBookmarkBudget({ oldPreference: "x".repeat(45000) }),
    /Existing data is unchanged/,
  );
});
test("keyword and reported employment filters never invent experience, salary or match scores", () => {
  const rows = validateJobResults([
    base,
    {
      ...base,
      id: "other",
      company: "Other",
      title: "Designer",
      employmentType: "contract",
      tags: ["Figma"],
    },
  ]);
  assert.equal(
    filterJobs(rows, { query: "react", employmentType: "full_time" }).length,
    1,
  );
  assert.equal(filterJobs(rows, { query: "example" }).length, 1);
  assert.equal(filterJobs(rows, { employmentType: "internship" }).length, 0);
  assert.equal(rows[0].salary, "");
});

test("malformed and repeated provider tags remain bounded without exposing script content", () => {
  assert.equal(
    providerDescription("<script>".repeat(12000)).descriptionText,
    "",
  );
  assert.equal(
    providerDescription("<!-- unclosed comment <img src=evil>").descriptionText,
    "",
  );
  const result = providerDescription("<".repeat(130000));
  assert.ok(result.descriptionText.length <= 24000);
  assert.equal(result.descriptionTruncated, true);
});
