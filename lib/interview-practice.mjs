// Original static practice material, not actual employer questions or AI output.
export const PRACTICE_QUESTIONS = [
  {
    id: "b-story",
    topic: "Behavioral",
    prompt: "Tell me about a time you worked through an unfamiliar problem.",
    guide:
      "Use a real situation. Describe your task, actions, result and what you learned. A personal or course project is valid.",
  },
  {
    id: "b-feedback",
    topic: "Behavioral",
    prompt: "How have you responded to constructive feedback?",
    guide:
      "Choose a truthful example. Explain what changed in your approach, without claiming outcomes you cannot support.",
  },
  {
    id: "b-team",
    topic: "Behavioral",
    prompt: "Describe a disagreement in a team and how you handled it.",
    guide:
      "Separate your own contribution from the team’s work. Explain how you listened and agreed on a next step.",
  },
  {
    id: "js-closure",
    topic: "JavaScript",
    prompt: "What is a closure in JavaScript? Give a small practical example.",
    guide:
      "Explain lexical scope, the surrounding variables retained by a function, and one trade-off such as retained memory.",
  },
  {
    id: "js-async",
    topic: "JavaScript",
    prompt: "Explain how promises, async/await and the event loop relate.",
    guide:
      "Distinguish synchronous execution, microtasks and tasks. Explain error propagation and why await does not block the whole browser.",
  },
  {
    id: "js-arrays",
    topic: "JavaScript",
    prompt: "When would you use map, filter and reduce?",
    guide:
      "Compare return values, explain mutation choices and give an example from code you actually wrote.",
  },
  {
    id: "react-state",
    topic: "React",
    prompt: "How do state and props affect a React component?",
    guide:
      "Explain ownership, re-rendering, controlled inputs and avoiding direct state mutation.",
  },
  {
    id: "react-effects",
    topic: "React",
    prompt: "When is an effect needed, and how would you clean one up?",
    guide:
      "Discuss synchronization with external systems, dependencies, cleanup and stale asynchronous responses.",
  },
  {
    id: "react-keys",
    topic: "React",
    prompt: "Why do stable keys matter in a rendered list?",
    guide:
      "Explain identity across renders and the risks of using array positions for an editable list.",
  },
  {
    id: "web-a11y",
    topic: "Web development",
    prompt: "How would you make a modal accessible?",
    guide:
      "Consider an accessible name, focus entry, trapping focus where appropriate, Escape and restoring focus.",
  },
  {
    id: "web-security",
    topic: "Web development",
    prompt: "How would you safely display user-provided or external text?",
    guide:
      "Discuss textContent, URL validation, server authorization and why a browser flag cannot grant paid access.",
  },
  {
    id: "web-performance",
    topic: "Web development",
    prompt: "How would you investigate a slow web page?",
    guide:
      "Start with measurements. Consider requests, rendering, long tasks, caching and a reproducible comparison.",
  },
  {
    id: "project-intro",
    topic: "Project presentation",
    prompt: "Present one project you built in two minutes.",
    guide:
      "Explain the problem, your actual contribution, architecture, one trade-off and the next improvement. Distinguish a project from paid employment.",
  },
  {
    id: "project-security",
    topic: "Project presentation",
    prompt: "Explain a security or privacy decision in your project.",
    guide:
      "Describe the implemented control, how you tested it and any integration that remains unverified.",
  },
  {
    id: "project-debug",
    topic: "Project presentation",
    prompt: "Walk through a bug you investigated and fixed.",
    guide:
      "Explain symptoms, evidence, root cause, fix and regression test. Use a real example rather than an invented metric.",
  },
  {
    id: "b-english",
    topic: "Behavioral",
    prompt:
      "Introduce yourself and explain what you want to learn in your next role.",
    guide:
      "Practice a concise English introduction using your real background, interests and goals.",
  },
];
export const PREPARATION = [
  "Research the role and its original source",
  "Review one real project and your contribution",
  "Prepare an honest introduction in English",
  "Check interview time zone and connection",
  "Prepare questions for the interviewer",
  "Review access needs and the interview format",
];
export function validatePractice(value) {
  if (
    !value ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 100 ||
    !PRACTICE_QUESTIONS.some((q) => q.id === value.questionId)
  )
    throw Error("Invalid practice history. Keep a backup before editing.");
  const answer = String(value.answer ?? "").trim();
  if (!answer || answer.length > 2000)
    throw Error("Write an answer of up to 2,000 characters before saving.");
  if (
    !Number.isFinite(value.seconds) ||
    value.seconds < 0 ||
    value.seconds > 86400
  )
    throw Error("Invalid practice duration.");
  if (
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt))
  )
    throw Error("Invalid practice date.");
  return {
    id: value.id,
    questionId: value.questionId,
    answer,
    seconds: Math.round(value.seconds),
    updatedAt: value.updatedAt,
    source: "static-practice",
  };
}
