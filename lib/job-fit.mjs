import { readStudio } from "./career-studio.mjs";
const technologies = {
  JavaScript: ["javascript", "js"],
  TypeScript: ["typescript", "ts"],
  React: ["react", "react.js", "reactjs"],
  "Node.js": ["node.js", "nodejs"],
  "Next.js": ["next.js", "nextjs"],
  HTML: ["html", "html5"],
  CSS: ["css", "css3"],
  Python: ["python"],
  Java: ["java"],
  SQL: ["sql"],
  PostgreSQL: ["postgresql", "postgres"],
  Docker: ["docker"],
  AWS: ["aws", "amazon web services"],
  Git: ["git"],
  GraphQL: ["graphql"],
  Vue: ["vue", "vue.js"],
  Angular: ["angular"],
  Tailwind: ["tailwind", "tailwindcss"],
  Jest: ["jest"],
  Vitest: ["vitest"],
  Playwright: ["playwright"],
  Accessibility: ["accessibility", "wcag"],
  Figma: ["figma"],
};
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function mentionedTechnologies(text) {
  return Object.entries(technologies)
    .filter(([, aliases]) =>
      aliases.some((alias) =>
        new RegExp(
          "(^|[^a-z0-9])" + escape(alias) + "(?=$|[^a-z0-9])",
          "i",
        ).test(text),
      ),
    )
    .map(([name]) => name);
}
export function explainJobFit(job, data) {
  let resumes = [];
  try {
    resumes = readStudio(data.preferences).resumes;
  } catch {}
  const declared = mentionedTechnologies(
    [
      ...(data.goals || []).flatMap((g) => g.skills || []),
      ...resumes.map((r) => r.skills),
    ].join(", "),
  );
  const source = [
    job.title,
    ...(job.tags || []),
    job.descriptionText || "",
  ].join("\n");
  const mentioned = mentionedTechnologies(source);
  const matched = mentioned.filter((t) => declared.includes(t)),
    missing = mentioned.filter((t) => !declared.includes(t));
  const languageMentions = [
    ...new Set(
      source.match(
        /\b(?:English|Portuguese|Spanish|French|German|Mandarin|Japanese)\b/gi,
      ) || [],
    ),
  ].map((x) => x.toLowerCase());
  const declaredLanguages = resumes
    .map((r) => r.languages)
    .filter(Boolean)
    .join("; ");
  const declaredExperience = [
    ...new Set(
      resumes.flatMap((r) =>
        r.experience
          .map((e) =>
            [e.heading, e.organization, e.period].filter(Boolean).join(" · "),
          )
          .filter(Boolean),
      ),
    ),
  ].slice(0, 8);
  const experience = [
    ...new Set(
      source.match(
        /[^\n.!?]{0,60}\b(?:junior|senior|internship|intern|entry.level|\d+\+? years?)\b[^\n!?]{0,90}/gi,
      ) || [],
    ),
  ]
    .slice(0, 4)
    .map((x) => x.trim());
  return {
    matched,
    missing,
    mentioned,
    declared,
    languageMentions,
    declaredLanguages,
    declaredExperience,
    location: job.location || "",
    declaredLocation: data.profile?.country || "",
    experience,
    hasDescription: !!job.descriptionText,
    source: job.source || "Source not supplied",
  };
}
