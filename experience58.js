// A presentation adapter; Auth, persistence and paid access remain in existing controllers.
import { t58, formatDate58 } from "./lib/i18n58.mjs";
import {
  resumeReadiness58,
  viewedJobs58,
  recommendJobs58,
  comparisonPrompt58,
  initials58,
} from "./lib/career58.mjs";
import { readStudio } from "./lib/career-studio.mjs";
import { openJobDetails, selectedJobKey } from "./jobs-experience.js";
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
let context = null,
  scope = null,
  recent = [],
  jobs = [],
  mounted = false,
  dialog = null,
  previousFocus = null,
  lastKey = "";
const studio = () => {
  try {
    return readStudio(context.data.preferences);
  } catch {
    return { resumes: [] };
  }
};
function panel(title, id) {
  const p = el("section", "panel section-pad evolution58-panel");
  p.id = id;
  p.append(el("h2", null, title));
  return p;
}
export function showDemo58(kind) {
  previousFocus = document.activeElement;
  dialog.replaceChildren();
  const header = el("div", "dialog-head");
  const heading = el("h2", null, t58("demoTitle"));
  heading.id = "demo58Title";
  header.append(
    heading,
    button(t58("closeDemo"), () => dialog.close()),
  );
  dialog.append(header, el("p", "demo58-notice", t58("demoNotice")));
  if (kind === "jobs") {
    const card = el("article", "demo58-card");
    card.append(
      el("p", "eyebrow", t58("demoKicker")),
      el("h3", null, t58("demoJobsTitle")),
      el("p", null, t58("demoJobsCompany")),
      el("p", "helper", t58("demoJobsCopy")),
    );
    const apply = button(t58("demoApply"), () => {});
    apply.disabled = true;
    card.append(apply);
    dialog.append(card);
  } else
    dialog.append(
      el("p", "demo58-question", t58("demoQuestion")),
      el("p", "demo58-answer", t58("demoAnswer")),
    );
  dialog.append(el("p", "helper", t58("openTour")));
  dialog.showModal();
}
function mount() {
  if (mounted) return;
  mounted = true;
  const dashboard = el("div", "horizon58-grid");
  dashboard.id = "horizon58";
  dashboard.append(
    panel(t58("readiness"), "resumeReadiness58"),
    panel(t58("recommendations"), "recommendations58"),
  );
  $("#dashboardMetrics").after(dashboard);
  const history = el("details", "panel section-pad recent58");
  history.id = "recentJobs58";
  history.append(
    el("summary", null, t58("recent")),
    el("p", "helper", t58("recentCopy")),
  );
  const list = el("div");
  list.id = "recentJobs58List";
  const status = el("p", "helper");
  status.id = "recentJobs58Status";
  status.setAttribute("role", "status");
  history.append(
    list,
    button(t58("clearRecent"), () => {
      recent = [];
      renderRecent();
      status.textContent = t58("historyCleared");
    }),
    status,
  );
  $("#jobsView .screen-heading").after(history);
  $("#jobsView .screen-heading").append(
    button(t58("tourJobs"), () => showDemo58("jobs")),
  );
  $("#coachView .screen-heading .intro-copy").textContent = t58("coachIntro");
  $("#coachView .screen-heading").append(
    button(t58("tourAI"), () => showDemo58("ai")),
  );
  dialog = el("dialog", "application-dialog demo58-dialog");
  dialog.id = "demo58Dialog";
  dialog.setAttribute("aria-labelledby", "demo58Title");
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    dialog.replaceChildren();
    if (previousFocus?.isConnected)
      previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  });
  document.body.append(dialog);
  const identity = panel(t58("avatarTitle"), "profileIdentity58");
  const avatar = el("span", "initials58");
  avatar.id = "initials58";
  avatar.setAttribute("aria-hidden", "true");
  identity.append(avatar, el("p", "helper", t58("avatarCopy")));
  $("#profileForm").before(identity);
  const sourceNote = el("p", "helper source58-note", t58("salaryUnchanged"));
  $("#jobSearchForm").append(sourceNote);
  const compare = panel(t58("comparison"), "comparison58");
  compare.append(el("p", "helper", t58("comparisonHelp")));
  const prepare = button(t58("comparison"), () => {
    const resume = studio().resumes[0];
    // Source selection is provided explicitly by the active details renderer below.
    const selected = selectedJob;
    if (!resume || !selected) return;
    if (!confirm(t58("compareConsent"))) return;
    const prompt = comparisonPrompt58(resume, selected);
    context.navigate("coach");
    $("#coachIntent").value = "advice";
    $("#coachPrompt").value = prompt;
    $("#coachPrompt").focus();
    $("#coachStatus").textContent = t58("comparisonPrepared");
  });
  prepare.id = "prepareComparison58";
  compare.append(prepare);
  comparisonPanel = compare;
}
let comparisonPanel,
  selectedJob = null;
function renderReadiness() {
  const root = $("#resumeReadiness58");
  root.replaceChildren(
    el("p", "eyebrow", t58("resumeKicker")),
    el("h2", null, t58("readiness")),
    el("p", "helper", t58("readinessCopy")),
  );
  const resume = studio().resumes[0],
    checks = resumeReadiness58(resume);
  if (!resume) root.append(el("p", "helper", t58("noResume")));
  else {
    root.append(
      el(
        "strong",
        "readiness58-count",
        t58("resumeFields", {
          filled: checks.filter((c) => c.present).length,
          total: checks.length,
        }),
      ),
    );
    const list = el("ul", "readiness58-list");
    for (const check of checks) {
      const row = el(
        "li",
        check.present ? "complete58" : "incomplete58",
        (check.present ? "✓ " : "○ ") + t58(check.key),
      );
      list.append(row);
    }
    const details = el("details", "readiness58-details");
    details.append(
      el("summary", null, t58("readinessDetails")),
      list,
      el("p", "helper", t58("privacy")),
    );
    root.append(details);
  }
  root.append(button(t58("resumeOpen"), () => context.navigate("resume")));
}
function renderOpportunities() {
  if (!mounted || !context) return;
  const root = $("#recommendations58");
  root.replaceChildren(
    el("p", "eyebrow", t58("sourceKicker")),
    el("h2", null, t58("recommendations")),
    el("p", "helper", t58("recommendedCopy")),
  );
  if (!jobs.length) root.append(el("p", "helper", t58("noJobs")));
  for (const { job, matched } of recommendJobs58(jobs, context.data)) {
    const row = el("article", "opportunity58");
    row.append(
      el("h3", null, job.title),
      el("p", "helper", job.company + " · " + job.source),
      el(
        "p",
        "helper",
        matched.length
          ? t58("matches", { count: matched.length })
          : t58("noMatch"),
      ),
      button(t58("viewDetails"), () => {
        context.navigate("jobs");
        openJobDetails(job);
      }),
    );
    root.append(row);
  }
  root.append(button(t58("openJobs"), () => context.navigate("jobs")));
}
function renderRecent() {
  if (!mounted) return;
  const list = $("#recentJobs58List");
  list.replaceChildren();
  if (!recent.length) list.append(el("p", "helper", t58("recentEmpty")));
  for (const job of recent) {
    const row = el("article", "recent58-row");
    row.append(
      el("strong", null, job.title),
      el(
        "p",
        "helper",
        job.company + " · " + job.source + " · " + formatDate58(job.postedAt),
      ),
      button(t58("viewDetails"), () => openJobDetails(job)),
    );
    list.append(row);
  }
}
export function recentJobs58(ownerScope) {
  return ownerScope === scope ? recent : [];
}
export function recordViewed58(job, ownerScope, changed = true) {
  if (!context || context.busy || scope !== ownerScope) return;
  if (changed) {
    recent = viewedJobs58(recent, job);
    renderRecent();
  }
  if (selectedJobKey() !== `${job.source || "Remotive"}:${job.id}`) return;
  selectedJob = job;
  const resume = studio().resumes[0];
  comparisonPanel.querySelector("button").disabled = !resume;
  comparisonPanel.querySelector(".helper").textContent = resume
    ? t58("comparisonHelp")
    : t58("comparisonMissing");
  $("#jobDetails").append(comparisonPanel);
}
export function refreshJobs58(rows, ownerScope) {
  if (scope !== ownerScope || jobs === rows) return;
  jobs = rows;
  renderOpportunities();
}
export function clearExperience58() {
  scope = null;
  context = null;
  recent = [];
  jobs = [];
  selectedJob = null;
  lastKey = "";
  if (!mounted) return;
  previousFocus = null;
  dialog.close();
  dialog.replaceChildren();
  comparisonPanel.remove();
  $("#horizon58")
    .querySelectorAll("section")
    .forEach((e) => e.replaceChildren());
  $("#initials58").textContent = "";
  renderRecent();
  $("#recentJobs58Status").textContent = "";
}
export function renderExperience58(next) {
  if (scope !== next.scope) {
    clearExperience58();
    scope = next.scope;
  }
  context = next;
  mount();
  $("#initials58").textContent = initials58(next.data.profile.display_name);
  const key = JSON.stringify([
    scope,
    next.busy,
    next.data.preferences.careerStudio55,
    next.data.goals,
    next.data.profile,
  ]);
  if (key !== lastKey) {
    lastKey = key;
    if (next.busy) {
      $("#resumeReadiness58").replaceChildren(
        el("p", "career-loading-skeleton", t58("loading")),
      );
      $("#recommendations58").replaceChildren();
    } else {
      renderReadiness();
      renderOpportunities();
    }
  }
  renderRecent();
}
