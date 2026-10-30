import { test } from "node:test";
import assert from "node:assert/strict";
import {
  momentumSeries,
  interviewSnapshot,
  careerPreferences57,
  saveCareerPreferences57,
} from "../lib/workspace57.mjs";
test("momentum spans six calendar months, validates dates and never substitutes records", () => {
  const rows = momentumSeries(
    [
      { applicationDate: "2026-10-03" },
      { applicationDate: "2026-10-20" },
      { applicationDate: "2026-05-31" },
      { applicationDate: "2026-02-30" },
      { applicationDate: "invalid" },
      {},
    ],
    new Date(2026, 9, 30),
  );
  assert.deepEqual(
    rows.map((r) => r.month),
    ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
  );
  assert.deepEqual(
    rows.map((r) => r.count),
    [1, 0, 0, 0, 0, 2],
  );
  assert.deepEqual(
    momentumSeries([], new Date(2027, 0, 1)).map((r) => r.month),
    ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"],
  );
  assert.equal(
    momentumSeries(
      [{ applicationDate: "2026-06-31" }],
      new Date(2026, 9, 30),
    ).reduce((s, r) => s + r.count, 0),
    0,
  );
});
test("interview snapshot is a documented current-status ratio with no fictional zero-data conversion", () => {
  assert.deepEqual(interviewSnapshot([]), {
    submitted: 0,
    reached: 0,
    percent: null,
  });
  assert.deepEqual(
    interviewSnapshot(
      [
        "Saved",
        "Applied",
        "Interview",
        "Offer",
        "Hired",
        "Rejected",
        "Withdrawn",
      ].map((status) => ({ status })),
    ),
    { submitted: 6, reached: 3, percent: 50 },
  );
});
test("career preferences preserve other data, bound personal content and share the existing UTF-8 preference budget", () => {
  const original = {
    other: "preserve",
    careerStudio55: { version: 1, resumes: [] },
  };
  const result = saveCareerPreferences57(original, {
    skills: "  JavaScript  ",
    languages: "English",
  });
  assert.equal(result.careerPreferences57.skills, "JavaScript");
  assert.deepEqual(result.careerStudio55, original.careerStudio55);
  assert.equal(original.careerPreferences57, undefined);
  assert.throws(() => careerPreferences57({ countries: [] }), /countries/);
  assert.throws(() => careerPreferences57({ skills: "x".repeat(801) }), /800/);
  assert.throws(
    () =>
      saveCareerPreferences57(
        { other: "界".repeat(15000) },
        { skills: "JavaScript" },
      ),
    /Nothing was saved/,
  );
  assert.equal(careerPreferences57({ unknown: "ignored" }).unknown, undefined);
});
test("malformed preference imports cannot silently replace valid settings", () => {
  for (const value of [null, [], 1, "text"])
    assert.throws(() => careerPreferences57(value), /object/);
  const saved = saveCareerPreferences57(
    { careerPreferences57: { futureField: "preserved" } },
    { skills: "JavaScript" },
  );
  assert.equal(saved.careerPreferences57.futureField, "preserved");
});
