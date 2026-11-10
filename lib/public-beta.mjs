import { readStudio, validateResume } from "./career-studio.mjs";
import { PRACTICE_QUESTIONS } from "./interview-practice.mjs";
import { mentionedTechnologies } from "./job-fit.mjs";
export function sourceFacts59(job) {
  const salary = String(job.salary || "").slice(0, 200);
  const codes = [
    ...new Set(
      (
        salary.match(
          /\b(?:USD|EUR|GBP|CAD|AUD|NZD|BRL|CHF|JPY|INR|SGD|CNY|AED|HKD|SEK|NOK|DKK|PLN|MXN|ZAR|KRW)\b/gi,
        ) || []
      ).map((x) => x.toUpperCase()),
    ),
  ];
  for (const [pattern, code] of [
    [/\bUS\$/i, "USD"],
    [/\bCA\$/i, "CAD"],
    [/€/, "EUR"],
  ])
    if (pattern.test(salary) && !codes.includes(code)) codes.push(code);
  const text = String(job.descriptionText || "").slice(0, 24000);
  const excerpts = text
    .split(/\n|(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) =>
      /\b(?:work authori[sz]ation|visa|sponsor\w*|eligib\w*|time[ -]?zones?|resid(?:e|en)\w*|based in|located in|right to work)\b/i.test(
        x,
      ),
    )
    .slice(0, 3)
    .map((x) => (x.length > 300 ? x.slice(0, 300) + "…" : x));
  return {
    salary,
    codes,
    location: String(job.location || ""),
    arrangement: job.arrangement || "",
    technologies: mentionedTechnologies(
      [job.title, ...(job.tags || []), text].join("\n"),
    ),
    excerpts,
  };
}
export function practiceCoverage59(practices, topic = "all") {
  const questions = PRACTICE_QUESTIONS.filter(
    (q) => topic === "all" || q.topic === topic,
  );
  const answered = new Set(
    practices.filter((p) => p.answer?.trim()).map((p) => p.questionId),
  );
  return {
    total: questions.length,
    answered: questions.filter((q) => answered.has(q.id)).length,
    next: questions.find((q) => !answered.has(q.id)) || null,
  };
}
export function preparationActions59(data) {
  const studio = readStudio(data.preferences),
    actions = [];
  actions.push({
    view: "resume",
    title: studio.resumes.length
      ? "Review a saved resume"
      : "Create your first resume",
    detail: studio.resumes.length
      ? `${studio.resumes.length} saved version${studio.resumes.length === 1 ? "" : "s"} · review before sharing`
      : "Start with your own projects, skills and languages. No invented experience.",
  });
  const coverage = practiceCoverage59(studio.practices);
  actions.push({
    view: "interview",
    title: coverage.next
      ? "Practice one unanswered question"
      : "Review your saved practice",
    detail: `${coverage.answered} of ${coverage.total} static questions have a saved answer. This is coverage, not an assessment.`,
  });
  actions.push({
    view: "jobs",
    title: "Check source requirements",
    detail:
      "Remote does not establish country eligibility, work authorization or visa sponsorship.",
  });
  return actions;
}
export function resumeText59(value) {
  const r = validateResume(value),
    lines = [
      r.name,
      r.title,
      [r.email, r.phone, r.location].filter(Boolean).join(" · "),
      r.github,
      r.portfolio,
    ];
  const section = (title, content) => {
    const text = content.filter(Boolean);
    if (text.length) lines.push("", title, ...text);
  };
  section("SUMMARY", [r.summary]);
  for (const [key, title] of [
    ["experience", "EXPERIENCE"],
    ["education", "EDUCATION"],
    ["projects", "PROJECTS"],
  ])
    section(
      title,
      r[key].flatMap((e) => [
        [e.heading, e.organization, e.period].filter(Boolean).join(" · "),
        e.description,
        e.url,
        "",
      ]),
    );
  section("SKILLS", [r.skills]);
  section("LANGUAGES", [r.languages]);
  return (
    lines
      .filter((x) => x !== undefined && x !== null)
      .join("\n")
      .trim() + "\n"
  );
}
