import test from "node:test";
import assert from "node:assert/strict";
import { mentionedTechnologies, explainJobFit } from "../lib/job-fit.mjs";
import { emptyResume, STUDIO_KEY } from "../lib/career-studio.mjs";
test("fit uses explicit text boundaries and alias matching without a numeric hiring score", () => {
  assert.deepEqual(mentionedTechnologies("JavaScript and React with Node.js"), [
    "JavaScript",
    "React",
    "Node.js",
  ]);
  assert.ok(!mentionedTechnologies("JavaScript").includes("Java"));
  const r = {
    ...emptyResume("r"),
    skills: "JS, React",
    languages: "English B2",
  };
  const data = {
    preferences: {
      [STUDIO_KEY]: { version: 1, resumes: [r], practices: [], checklist: [] },
    },
    goals: [{ skills: ["Git"] }],
    profile: { country: "Brazil" },
  };
  r.experience = [
    {
      heading: "Declared role",
      organization: "Example employer",
      period: "User-supplied dates",
      description: "",
      url: "",
    },
  ];
  const result = explainJobFit(
    {
      title: "Senior frontend engineer",
      tags: ["TypeScript"],
      descriptionText:
        "Use JavaScript and React. English. 3+ years of experience.",
      location: "Canada only",
      source: "Fixture",
    },
    data,
  );
  assert.deepEqual(result.matched, ["JavaScript", "React"]);
  assert.deepEqual(result.missing, ["TypeScript"]);
  assert.equal(result.declaredLocation, "Brazil");
  assert.equal(result.location, "Canada only");
  assert.ok(result.experience.some((x) => x.includes("3+ years")));
  assert.deepEqual(result.languageMentions, ["english"]);
  assert.deepEqual(result.declaredExperience, [
    "Declared role · Example employer · User-supplied dates",
  ]);
  assert.equal(result.score, undefined);
  assert.equal(result.eligible, undefined);
});
test("missing source or profile details remain unavailable rather than guessed from company or salary", () => {
  const r = explainJobFit(
    { title: "Developer", company: "A global company" },
    { preferences: {}, goals: [], profile: {} },
  );
  assert.deepEqual(r.matched, []);
  assert.deepEqual(r.missing, []);
  assert.equal(r.location, "");
  assert.equal(r.declaredLanguages, "");
  assert.equal(r.hasDescription, false);
});
import { careerNextStep, careerActivity } from "../lib/career-intelligence.mjs";
test("next-step rules prioritize dated commitments, then actual milestones and preparation gaps", () => {
  const d = { applications: [], goals: [], milestones: [], preferences: {} };
  assert.equal(careerNextStep(d).view, "resume");
  d.milestones = [{ title: "A real next milestone", completed: false }];
  assert.equal(careerNextStep(d).title, "A real next milestone");
  d.applications = [
    {
      id: "a",
      company: "Example",
      role: "Engineer",
      status: "Applied",
      interviewAt: "2026-11-10T10:00",
    },
  ];
  assert.match(
    careerNextStep(d, new Date("2026-11-01T12:00:00")).title,
    /interview/,
  );
  assert.deepEqual(careerActivity(d), []);
  d.applications[0].updates = [
    {
      at: "2026-10-28T10:00:00Z",
      summary: "Opportunity created",
      type: "created",
    },
  ];
  assert.equal(careerActivity(d).length, 1);
});
import { upcomingCommitments } from "../lib/career-intelligence.mjs";
test("an interview earlier today is not recommended as upcoming while a day-only deadline remains actionable", () => {
  const apps = [
    {
      id: "a",
      company: "Example",
      role: "Engineer",
      status: "Interview",
      interviewAt: "2026-10-28T09:00:00",
      deadline: "2026-10-28",
    },
    {
      id: "b",
      company: "Next",
      role: "Engineer",
      status: "Applied",
      interviewAt: "2026-10-28T17:00:00",
    },
  ];
  const events = upcomingCommitments(apps, new Date("2026-10-28T12:00:00"));
  assert.equal(events.filter((e) => e.kind === "Interview").length, 1);
  assert.equal(events.find((e) => e.kind === "Interview").company, "Next");
  assert.equal(events.filter((e) => e.kind === "Deadline").length, 1);
});
