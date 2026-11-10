import test from "node:test";
import assert from "node:assert/strict";
import {
  sourceFacts59,
  practiceCoverage59,
  preparationActions59,
  resumeText59,
} from "../lib/public-beta.mjs";
import { emptyResume } from "../lib/career-studio.mjs";
import { PRACTICE_QUESTIONS } from "../lib/interview-practice.mjs";
test("source currency only recognizes explicit source codes or unambiguous symbols", () => {
  assert.deepEqual(sourceFacts59({ salary: "$90k–120k" }).codes, []);
  assert.deepEqual(sourceFacts59({ salary: "US$ 90,000, CAD 100,000" }).codes, [
    "CAD",
    "USD",
  ]);
  assert.deepEqual(sourceFacts59({ salary: "€50k" }).codes, ["EUR"]);
  assert.deepEqual(sourceFacts59({ salary: "£50k" }).codes, []);
  assert.deepEqual(sourceFacts59({}).codes, []);
});
test("source excerpts preserve negative and limited eligibility without granting eligibility", () => {
  const f = sourceFacts59({
    location: "Worldwide",
    salary: "Negotiable",
    descriptionText:
      "No visa sponsorship. Applicants must reside in Brazil. Work authorization is required. This is another sentence.",
  });
  assert.equal(f.location, "Worldwide");
  assert.equal(f.excerpts.length, 3);
  assert.ok(f.excerpts.includes("No visa sponsorship."));
  assert.equal("eligible" in f, false);
});
test("technology mentions have boundaries and do not pretend every mention is required", () => {
  const f = sourceFacts59({
    title: "React engineer",
    tags: ["TypeScript"],
    descriptionText: "Java is not required. We value accessibility.",
  });
  assert.deepEqual(f.technologies, [
    "TypeScript",
    "React",
    "Java",
    "Accessibility",
  ]);
  assert.equal("requiredSkills" in f, false);
});
test("source requirement excerpts are bounded and stay plain text", () => {
  const f = sourceFacts59({
    descriptionText: "Visa <script>alert(1)</script> " + "x".repeat(25000),
  });
  assert.ok(f.excerpts[0].includes("<script>"));
  assert.ok(f.excerpts[0].length <= 301);
});
test("practice coverage counts distinct nonempty answers, not exercises or competence", () => {
  const q = PRACTICE_QUESTIONS[0];
  const p = [
    { questionId: q.id, answer: "My answer" },
    { questionId: q.id, answer: "Another answer" },
    { questionId: PRACTICE_QUESTIONS[1].id, answer: "  " },
    { questionId: "unknown", answer: "text" },
  ];
  assert.equal(practiceCoverage59(p).answered, 1);
  assert.equal(practiceCoverage59(p).next.id, PRACTICE_QUESTIONS[1].id);
  assert.equal(practiceCoverage59(p, "React").answered, 0);
});
test("all answered questions do not produce invented improvement claims", () => {
  const s = practiceCoverage59(
    PRACTICE_QUESTIONS.map((q) => ({ questionId: q.id, answer: "Saved" })),
  );
  assert.equal(s.next, null);
  assert.equal(s.answered, s.total);
});
test("preparation actions use the current empty workspace and never mutate it", () => {
  const d = { preferences: {} };
  const before = JSON.stringify(d);
  assert.match(preparationActions59(d)[0].title, /first resume/);
  assert.equal(JSON.stringify(d), before);
});
test("plain text export includes supplied evidence and languages without invented qualifications", () => {
  const r = emptyResume("r");
  Object.assign(r, {
    name: "Álex",
    summary: "Personal projects, not employment.",
    languages: "English: self-declared A2",
    projects: [
      {
        heading: "My project",
        organization: "Personal",
        period: "2026",
        description: "No revenue claim.",
        url: "",
      },
    ],
  });
  const text = resumeText59(r);
  assert.match(text, /Álex/);
  assert.match(text, /PROJECTS\nMy project/);
  assert.match(text, /English: self-declared A2/);
  assert.doesNotMatch(text, /EXPERIENCE|CERTIFIED|ATS score/);
});
test("plain text export validates original boundaries and unsafe links", () => {
  assert.throws(
    () => resumeText59({ ...emptyResume("r"), github: "javascript:alert(1)" }),
    /safe|http/,
  );
});
