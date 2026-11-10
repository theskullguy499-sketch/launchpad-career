// Derived, owner-scoped presentation. Tours never use customer records or write storage.
import { readStudio } from "./lib/career-studio.mjs";
import {
  sourceFacts59,
  practiceCoverage59,
  preparationActions59,
  resumeText59,
} from "./lib/public-beta.mjs";
import { showDemo58 } from "./experience58.js";
import { selectedJobKey } from "./jobs-experience.js";
const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = String(text);
  return n;
};
const button = (text, run, cls = "button button-outline") => {
  const b = el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", run);
  return b;
};
const panel = (title, id) => {
  const n = el("section", "panel section-pad beta59-panel");
  n.id = id;
  n.append(el("h2", null, title));
  return n;
};
let context = null,
  scope = null,
  mounted = false,
  dialog,
  returnFocus = null,
  step = 0,
  moved = false,
  modern = false,
  guide = false;
const steps = [
  "Overview",
  "Applications",
  "Resume",
  "Interview",
  "Jobs",
  "AI coach",
];
function demoContent() {
  const root = el("section", "beta59-example");
  root.id = "portfolioExample59";
  root.setAttribute("aria-label", steps[step] + " example");
  root.append(el("p", "eyebrow", "FICTIONAL SAMPLE · NOT YOUR WORKSPACE"));
  if (step === 0) {
    root.append(
      el("h3", null, "A clearer next chapter."),
      el(
        "p",
        null,
        "Explore a career workflow without an account, private data or payment. Every example stays inside this dialog.",
      ),
    );
    const cards = el("div", "beta59-demo-grid");
    for (const [title, copy] of [
      ["Explore", "Check sourced role requirements."],
      ["Build", "Describe your actual skills and projects."],
      ["Prepare", "Practise an honest interview answer."],
    ]) {
      const c = el("article", "beta59-demo-card");
      c.append(el("h4", null, title), el("p", null, copy));
      cards.append(c);
    }
    root.append(cards);
  } else if (step === 1) {
    root.append(
      el("h3", null, "Try a sample pipeline."),
      el(
        "p",
        null,
        "This sample is not a real application. Moving it changes this preview only.",
      ),
    );
    const board = el("div", "beta59-demo-grid");
    for (const stage of ["Saved", "Applied", "Interview"]) {
      const col = el("section", "beta59-demo-card");
      col.append(el("h4", null, stage));
      if (stage === (moved ? "Interview" : "Applied")) {
        const card = el("article", "beta59-demo-application");
        card.append(
          el("strong", null, "Sample frontend role"),
          el("p", null, "Example employer · fictional"),
        );
        col.append(card);
      }
      board.append(col);
    }
    const live = el(
      "p",
      "helper",
      moved
        ? "Sample moved to Interview. No records were saved."
        : "Sample starts in Applied.",
    );
    live.setAttribute("role", "status");
    root.append(
      board,
      button(
        moved ? "Reset sample application" : "Move sample to Interview",
        () => {
          moved = !moved;
          renderDemo("action");
        },
      ),
      live,
    );
  } else if (step === 2) {
    root.append(
      el("h3", null, "An honest, readable resume."),
      el(
        "p",
        null,
        "Illustrative personal project. This is not a real candidate or qualification.",
      ),
    );
    const paper = el(
      "article",
      "beta59-demo-paper" + (modern ? " beta59-modern" : ""),
    );
    paper.append(
      el("h4", null, "Example candidate"),
      el("p", null, "Aspiring web developer · example only"),
      el("h4", null, "PERSONAL PROJECT"),
      el(
        "p",
        null,
        "A career tracker prototype. Explain your own contribution and one technical trade-off. Do not invent employment or results.",
      ),
    );
    root.append(
      paper,
      button("Switch sample resume template", () => {
        modern = !modern;
        renderDemo("action");
      }),
      el(
        "p",
        "helper",
        modern ? "Modern sample layout" : "Classic sample layout",
      ),
    );
  } else if (step === 3) {
    root.append(
      el("h3", null, "Practice with intent."),
      el("p", "practice-badge", "STATIC PRACTICE · NOT AI FEEDBACK"),
      el("blockquote", null, "Present one project you built in two minutes."),
      button(
        guide ? "Hide sample answer structure" : "Show sample answer structure",
        () => {
          guide = !guide;
          renderDemo("action");
        },
      ),
    );
    if (guide) {
      const list = el("ol");
      for (const text of [
        "State the problem you addressed.",
        "Explain your own contribution.",
        "Discuss one implemented decision and its limits.",
        "Name the next improvement without inventing results.",
      ])
        list.append(el("li", null, text));
      root.append(list);
    }
  } else {
    root.append(
      el(
        "h3",
        null,
        step === 4
          ? "Source-first job discovery."
          : "A coach with clear boundaries.",
      ),
      el(
        "p",
        null,
        step === 4
          ? "The job example is clearly labelled, cannot be applied to and never becomes a live listing. Real jobs require a configured authorized source."
          : "The existing assistant tour is a scripted example, not generative AI. Real requests require the secure backend, consent and available server-authorized credits.",
      ),
    );
    root.append(
      button(
        step === 4
          ? "Open isolated job example"
          : "Open scripted coach example",
        () => {
          const focus = returnFocus;
          dialog.close();
          focus?.focus({ preventScroll: true });
          showDemo58(step === 4 ? "jobs" : "ai");
        },
      ),
    );
  }
  return root;
}
function renderDemo(reason = "step") {
  const oldActive = document.activeElement?.textContent;
  dialog.replaceChildren();
  const head = el("header", "dialog-head");
  const title = el("h2", null, "Explore Launchpad");
  title.id = "portfolioTitle59";
  head.append(
    title,
    button("Close public demo", () => dialog.close()),
  );
  const notice = el(
    "p",
    "beta59-notice",
    "DEMO ONLY · No private data, provider requests, subscriptions or saved changes.",
  );
  notice.id = "portfolioNotice59";
  const nav = el("nav", "beta59-demo-nav");
  nav.setAttribute("aria-label", "Public demo sections");
  steps.forEach((name, i) => {
    const b = button(`${i + 1}. ${name}`, () => {
      step = i;
      renderDemo();
    });
    b.setAttribute("aria-pressed", String(step === i));
    nav.append(b);
  });
  const count = el(
    "p",
    "helper",
    `Step ${step + 1} of ${steps.length} · ${steps[step]}`,
  );
  count.setAttribute("role", "status");
  const actions = el("div", "button-row");
  const back = button("Previous section", () => {
    step--;
    renderDemo();
  });
  back.disabled = step === 0;
  const next = button(
    step === steps.length - 1 ? "Finish public demo" : "Next section",
    () => {
      if (step === steps.length - 1) dialog.close();
      else {
        step++;
        renderDemo();
      }
    },
  );
  actions.append(back, next);
  dialog.append(head, notice, nav, count, demoContent(), actions);
  if (dialog.open) {
    if (reason === "action") {
      const same = [...dialog.querySelectorAll("button")].find(
        (b) => b.textContent === oldActive,
      );
      (same || dialog.querySelector("#portfolioExample59 button"))?.focus({
        preventScroll: true,
      });
    } else {
      dialog.scrollTop = 0;
      dialog
        .querySelector(`.beta59-demo-nav button:nth-child(${step + 1})`)
        .focus({ preventScroll: true });
    }
  }
}
function openDemo() {
  returnFocus = document.activeElement;
  step = 0;
  moved = false;
  modern = false;
  guide = false;
  renderDemo();
  dialog.showModal();
}
function mount() {
  if (mounted) return;
  mounted = true;
  const entry = panel(
    "See the workspace before you sign up.",
    "publicDemoEntry59",
  );
  entry.classList.add("beta59-entry");
  entry.prepend(
    el("p", "eyebrow", "PUBLIC BETA CANDIDATE · PORTFOLIO PREVIEW"),
  );
  entry.append(
    el(
      "p",
      null,
      "A clearly labelled, interactive walkthrough for recruiters and curious visitors. No account, payment or customer records are needed.",
    ),
    button("Explore public demo", openDemo, "button button-primary"),
  );
  $("#homeView .landing-hero").after(entry);
  dialog = el("dialog", "application-dialog beta59-dialog");
  dialog.id = "portfolioDemo59";
  dialog.setAttribute("aria-labelledby", "portfolioTitle59");
  dialog.setAttribute("aria-describedby", "portfolioNotice59");
  document.body.append(dialog);
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    step = 0;
    moved = false;
    modern = false;
    guide = false;
    dialog.replaceChildren();
    if (!document.querySelector("dialog[open]") && returnFocus?.isConnected)
      returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  });
  const queue = panel("Your preparation, one step at a time.", "preparation59");
  queue.prepend(el("p", "eyebrow", "BASED ON YOUR SAVED MATERIAL"));
  $("#horizon58").after(queue);
  const resume = panel("A portable text copy.", "resumeExport59");
  resume.append(
    el(
      "p",
      "helper",
      "Export only the selected saved version as UTF-8 text. Unsaved edits are excluded. No upload or AI request occurs; ATS compatibility is not guaranteed.",
    ),
  );
  const exportBtn = button("Export saved resume as text", () => {
    if (!context || context.busy) return;
    const r = readStudio(context.data.preferences).resumes.find(
      (x) => x.id === $("#resumeVersion").value,
    );
    if (!r) return;
    const url = URL.createObjectURL(
        new Blob([resumeText59(r)], { type: "text/plain;charset=utf-8" }),
      ),
      a = el("a");
    a.href = url;
    a.download = "launchpad-resume.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    $("#resumeTextStatus59").textContent =
      "Text copy prepared from the saved version. Review personal details before sharing.";
  });
  exportBtn.id = "exportResumeText59";
  const status = el("p", "helper");
  status.id = "resumeTextStatus59";
  status.setAttribute("role", "status");
  resume.append(exportBtn, status);
  $("#resumeView .career-toolbar").after(resume);
  $("#resumeVersion").addEventListener("change", () =>
    queueMicrotask(renderSavedResume),
  );
  const practice = panel("Choose your next practice.", "practiceCoverage59");
  $("#interviewView .career-heading").after(practice);
  $("#practiceTopic").addEventListener("change", () =>
    queueMicrotask(renderPractice),
  );
}
function renderSavedResume() {
  if (!context) return;
  const s = readStudio(context.data.preferences);
  const saved = s.resumes.find((r) => r.id === $("#resumeVersion").value);
  $("#exportResumeText59").disabled = context.busy || !saved;
  $("#resumeTextStatus59").textContent = context.busy
    ? "Loading this workspace…"
    : saved
      ? `Saved version: ${saved.label}. Save edits before exporting an updated copy.`
      : "Save a resume version to enable text export.";
}
function renderPractice() {
  if (!context) return;
  const root = $("#practiceCoverage59");
  root.replaceChildren(el("h2", null, "Choose your next practice."));
  if (context.busy) {
    root.append(el("p", "career-loading-skeleton", "Loading this workspace…"));
    return;
  }
  const coverage = practiceCoverage59(
    readStudio(context.data.preferences).practices,
    $("#practiceTopic").value,
  );
  root.append(
    el(
      "p",
      "beta59-coverage",
      `${coverage.answered} / ${coverage.total} questions with a saved answer`,
    ),
    el(
      "p",
      "helper",
      "Coverage of static practice material, not a readiness score or AI evaluation. Repeated exercises count once.",
    ),
  );
  if (coverage.next)
    root.append(
      el("p", null, coverage.next.prompt),
      button("Practice next unanswered question", () => {
        if (!context || context.busy) return;
        const select = $("#practiceQuestion");
        select.value = coverage.next.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        if (select.value === coverage.next.id) $("#practiceAnswer").focus();
      }),
    );
  else
    root.append(
      el(
        "p",
        null,
        "Every question in this topic has a saved answer. Review your history or choose another topic.",
      ),
    );
}
export function renderExperience59(next) {
  if (scope !== next.scope) {
    clearExperience59();
    scope = next.scope;
  }
  context = next;
  mount();
  const queue = $("#preparation59");
  queue.replaceChildren(
    el("p", "eyebrow", "BASED ON YOUR SAVED MATERIAL"),
    el("h2", null, "Your preparation, one step at a time."),
  );
  if (next.busy)
    queue.append(el("p", "career-loading-skeleton", "Loading this workspace…"));
  else {
    const grid = el("div", "beta59-action-grid");
    try {
      for (const item of preparationActions59(next.data)) {
        const card = el("article", "beta59-action");
        card.append(
          el("h3", null, item.title),
          el("p", "helper", item.detail),
          button(
            "Open " +
              {
                resume: "Resume Studio",
                interview: "Interview Lab",
                jobs: "Job Explorer",
              }[item.view],
            () => context.navigate(item.view),
          ),
        );
        grid.append(card);
      }
      queue.append(grid);
    } catch {
      queue.append(
        el(
          "p",
          "helper",
          "Career material could not be read. Keep a JSON backup before editing.",
        ),
      );
    }
  }
  try {
    renderSavedResume();
    renderPractice();
  } catch {
    $("#resumeTextStatus59").textContent =
      "Career material could not be read. Keep your backup.";
    $("#exportResumeText59").disabled = true;
    $("#practiceCoverage59").replaceChildren(
      el("p", null, "Career material could not be read. Keep your backup."),
    );
  }
}
export function showSourceFacts59(job, ownerScope) {
  if (
    !context ||
    context.busy ||
    ownerScope !== scope ||
    selectedJobKey() !== `${job.source || "Remotive"}:${job.id}`
  )
    return;
  $("#sourceFacts59")?.remove();
  const facts = sourceFacts59(job),
    root = panel("Before you apply internationally.", "sourceFacts59");
  root.prepend(
    el("p", "eyebrow", "LITERAL SOURCE FACTS · NO ELIGIBILITY SCORE"),
  );
  const list = el("dl", "job-facts");
  for (const [label, value] of [
    ["Source location", facts.location || "Not supplied"],
    ["Source work arrangement", facts.arrangement || "Not supplied"],
    ["Salary as supplied", facts.salary || "Not supplied"],
    [
      "Currency identifiers in source salary",
      facts.codes.join(", ") ||
        "No explicit recognized currency code. A bare $ or £ is not enough to infer one.",
    ],
    [
      "Recognized technology mentions",
      facts.technologies.join(", ") || "No recognized terms supplied",
    ],
  ])
    list.append(el("dt", null, label), el("dd", null, value));
  root.append(
    list,
    el(
      "p",
      "helper",
      "Technology mentions can include optional or negated terms. Read the original requirements. Remote or Worldwide does not establish eligibility, sponsorship, tax treatment or permission to work.",
    ),
  );
  if (facts.excerpts.length) {
    root.append(el("h3", null, "Source excerpts to check"));
    for (const text of facts.excerpts)
      root.append(el("blockquote", "beta59-source-quote", text));
  } else
    root.append(
      el(
        "p",
        "helper",
        "No country/visa/time-zone requirement excerpts recognized in the supplied description. This does not prove that no restrictions exist.",
      ),
    );
  root.append(
    el(
      "p",
      "helper",
      "Excerpts may be incomplete. Confirm location, currency and authorization with the original source. No salary conversion or geographic eligibility is inferred.",
    ),
  );
  $("#jobDetails").append(root);
}
export function clearExperience59() {
  context = null;
  scope = null;
  if (!mounted) return;
  returnFocus = null;
  dialog.close();
  dialog.replaceChildren();
  $("#sourceFacts59")?.remove();
  $("#preparation59").replaceChildren();
  $("#resumeTextStatus59").textContent = "";
  $("#exportResumeText59").disabled = true;
  $("#practiceCoverage59").replaceChildren();
}
