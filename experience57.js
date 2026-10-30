import { readStudio } from "./lib/career-studio.mjs";
import { PRACTICE_QUESTIONS, PREPARATION } from "./lib/interview-practice.mjs";
// 5.7 composition layer. Existing controllers remain owners of forms, state and services.
import {
  momentumSeries,
  interviewSnapshot,
  preferenceFields57,
  careerPreferences57,
  saveCareerPreferences57,
} from "./lib/workspace57.mjs";
import { careerNextStep } from "./lib/career-intelligence.mjs";
const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = String(text);
  return n;
};
const link = (text, view) => {
  const a = el("a", "button button-outline", text);
  a.href = "#" + view;
  return a;
};
let context,
  scope = null,
  mounted = false,
  dirty = false,
  renderKey = "",
  epoch = 0;
const headings = {
  companies: [
    "Companies worth discovering.",
    "Research employers with intent. Save your favorites and follow official careers links.",
  ],
  analytics: [
    "Make progress measurable.",
    "A clear view of your own applications, milestones and next steps.",
  ],
  settings: [
    "Make Launchpad yours.",
    "Your profile, your preferences, your data. Always in your control.",
  ],
};
function mount() {
  if (mounted) return;
  mounted = true;
  document.body.dataset.experience = "5.7";
  for (const [view, [title, copy]] of Object.entries(headings)) {
    const root = $("#" + view + "View");
    const h = root.querySelector("h1");
    h.textContent = title;
    const p = root.querySelector(".screen-heading .intro-copy");
    if (p) p.textContent = copy;
  }
  const hero = $("#homeView .landing-hero");
  hero.classList.add("discover57");
  const art = el("img", "discover-orbit57");
  art.src = "assets/orbit57.svg";
  art.alt = "";
  art.width = 480;
  art.height = 360;
  hero.append(art);
  const cards = hero.querySelectorAll(".value-grid article");
  const items = [
    [
      "Explore",
      "Find opportunities with intention.",
      "Research companies and discover sourced jobs when the service is available.",
      "jobs",
    ],
    [
      "Build",
      "Tell your story, with confidence.",
      "Create an honest resume and prepare for interviews with your own work.",
      "resume",
    ],
    [
      "Plan",
      "Give your next chapter direction.",
      "Turn a career objective into milestones and manageable study tasks.",
      "roadmap",
    ],
  ];
  items.forEach(([label, title, copy, view], i) => {
    cards[i].replaceChildren(
      el("span", null, `0${i + 1} / ${label.toUpperCase()}`),
      el("h2", null, title),
      el("p", null, copy),
      link(
        {
          jobs: "Explore jobs",
          resume: "Open Resume Studio",
          roadmap: "Build your roadmap",
        }[view],
        view,
      ),
    );
  });
  const next = el("section", "momentum57-grid");
  next.id = "momentum57";
  const chart = el("article", "panel momentum57-chart");
  chart.append(
    el("p", "eyebrow", "YOUR RECORDED ACTIVITY"),
    el("h2", null, "Your progress, in focus."),
    el(
      "p",
      "helper",
      "Tracked records by application date · last six calendar months.",
    ),
  );
  const bars = el("div", "momentum57-bars");
  bars.id = "momentum57Bars";
  const chartData = el("details", "momentum57-data");
  chartData.append(el("summary", null, "View chart data and definition"));
  chartData.id = "momentum57Data";
  chart.append(bars, chartData);
  const step = el("article", "panel momentum57-next");
  step.id = "momentum57Next";
  next.append(chart, step);
  $("#dashboardMetrics").after(next);
  // Keep existing hero/actions available while giving actual activity the first row.
  const oldHero = $("#dashboardView .ascent-hero");
  $("#dashboardView .studio-story-grid").append(oldHero);
  $("#dashboardView .studio-canvas").append($("#intelligenceDashboard"));
  const emptyChart = el(
    "p",
    "helper",
    "No dated applications in this period. Add an opportunity and an application date to start your chart.",
  );
  emptyChart.id = "momentum57Empty";
  bars.after(emptyChart);
  const prep = el("section", "practice-overview57");
  prep.id = "practiceOverview57";
  $("#interviewView .interview-workbench").before(prep);
  const privacy = $("#resumeView .career-privacy"),
    privacyDetails = el("details", "resume-storage57");
  privacyDetails.append(
    el("summary", null, "Storage and privacy details"),
    privacy.querySelector("p"),
  );
  privacy.querySelector("h2").remove();
  privacy.prepend(privacyDetails);

  const summary = el("section", "panel snapshot57");
  summary.id = "interviewSnapshot57";
  $("#analyticsView .screen-heading").after(summary);
  const form = el("form", "panel section-pad preferences57");
  form.id = "careerPreferences57";
  form.noValidate = true;
  form.append(
    el("p", "eyebrow", "YOUR CAREER CONTEXT"),
    el("h2", null, "Career preferences"),
    el(
      "p",
      "helper",
      "Self-declared preferences, saved only in the active workspace. These fields do not prove eligibility and are not automatically sent to AI.",
    ),
  );
  const fields = el("div", "career-form-grid");
  for (const [key, label, max] of preferenceFields57) {
    const wrap = el("label");
    const input = el("textarea");
    input.id = "preference57-" + key;
    input.name = key;
    input.maxLength = max;
    input.rows = 2;
    input.autocomplete = "off";
    wrap.append(el("span", null, label), input);
    fields.append(wrap);
  }
  form.append(fields);
  const consent = el("label", "check-label");
  consent.id = "preference57ConsentLabel";
  const checkbox = el("input");
  checkbox.type = "checkbox";
  checkbox.id = "preference57Consent";
  consent.append(
    checkbox,
    document.createTextNode(
      "I agree to save these career details to my private Supabase workspace.",
    ),
  );
  form.append(consent);
  const submit = el(
    "button",
    "button button-primary",
    "Save career preferences",
  );
  submit.type = "submit";
  const status = el("p", "helper");
  status.id = "preference57Status";
  status.setAttribute("role", "status");
  form.append(submit, status);
  form.addEventListener("input", () => {
    dirty = true;
    status.textContent =
      "Unsaved preferences · choose Save career preferences.";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (context.busy || submit.disabled) return;
    const ticket = epoch,
      ownerContext = context;
    const value = Object.fromEntries(
      preferenceFields57.map(([key]) => [key, $("#preference57-" + key).value]),
    );
    try {
      if (context.mode === "account" && !checkbox.checked)
        throw Error(
          "Confirm private cloud storage before saving these career details.",
        );
      careerPreferences57(value);
      submit.disabled = true;
      // Fingerprint protects typing while an existing cloud request is in flight.
      const signature = JSON.stringify(value);
      await ownerContext.update((next) => {
        next.preferences = saveCareerPreferences57(next.preferences, value);
      });
      if (ticket !== epoch) return;
      const current = Object.fromEntries(
        preferenceFields57.map(([key]) => [
          key,
          $("#preference57-" + key).value,
        ]),
      );
      dirty = JSON.stringify(current) !== signature;
      status.textContent = dirty
        ? "Submitted preferences saved. Newer edits are still unsaved."
        : "Career preferences saved in this workspace.";
    } catch (error) {
      if (ticket === epoch) status.textContent = error.message;
    } finally {
      if (ticket === epoch) submit.disabled = false;
    }
  });
  $("#profileForm").after(form);
  // These are prompt starters only: never send personal information or fake replies.
  const prompts = $("#coachForm .coach-suggestions");
  if (prompts) {
    for (const [label, prompt] of [
      [
        "International career",
        "Help me plan an international career. Ask about my target countries and do not assume work authorization.",
      ],
      [
        "Salary negotiation",
        "Help me prepare an honest salary negotiation based on the role and evidence I can provide.",
      ],
    ]) {
      const b = el("button", "button button-outline", label);
      b.type = "button";
      b.addEventListener("click", () => {
        $("#coachPrompt").value = prompt;
        $("#coachPrompt").focus();
      });
      prompts.append(b);
    }
  }
}
export function clearExperience57() {
  epoch++;
  scope = null;
  dirty = false;
  renderKey = "";
  if (!mounted) return;
  $("#careerPreferences57").reset();
  $("#preference57Status").textContent = "";
  $("#careerPreferences57 button").disabled = false;
  $("#momentum57Data")
    .querySelectorAll("p")
    .forEach((p) => p.remove());
  $("#momentum57Bars").removeAttribute("aria-label");
  $("#momentum57Bars").replaceChildren();
  $("#momentum57Next").replaceChildren();
  $("#momentum57Empty").hidden = true;
  $("#practiceOverview57").replaceChildren();
  $("#interviewSnapshot57").replaceChildren();
}
export function renderExperience57(next) {
  context = next;
  mount();
  if (scope !== next.scope) {
    clearExperience57();
    scope = next.scope;
  }
  const form = $("#careerPreferences57");
  $("#preference57ConsentLabel").hidden = next.mode !== "account";
  if (!dirty && !form.contains(document.activeElement)) {
    let prefs;
    try {
      prefs = careerPreferences57(next.data.preferences.careerPreferences57);
    } catch {
      prefs = careerPreferences57();
    }
    for (const [key] of preferenceFields57)
      $("#preference57-" + key).value = prefs[key];
  }
  const key = JSON.stringify([
    scope,
    next.busy,
    next.data.applications,
    next.data.milestones,
    next.data.goals,
    next.data.preferences.careerStudio55,
  ]);
  if (key === renderKey) return;
  renderKey = key;
  const bars = $("#momentum57Bars"),
    step = $("#momentum57Next"),
    snapshot = $("#interviewSnapshot57");
  bars.replaceChildren();
  step.replaceChildren();
  snapshot.replaceChildren();
  if (next.busy) {
    bars.removeAttribute("role");
    bars.setAttribute("aria-busy", "true");
    bars.append(el("p", "career-loading-skeleton", "Loading this workspace…"));
    return;
  }
  bars.removeAttribute("aria-busy");
  $("#momentum57Empty").hidden = momentumSeries(next.data.applications).some(
    (row) => row.count > 0,
  );
  const prep = $("#practiceOverview57");
  prep.replaceChildren();
  let studio;
  try {
    studio = readStudio(next.data.preferences);
  } catch {
    studio = null;
  }
  for (const [title, value, copy] of [
    [
      "Saved exercises",
      studio?.practices.length ?? "—",
      "Your own practice history",
    ],
    [
      "Preparation checklist",
      studio ? `${studio.checklist.length} / ${PREPARATION.length}` : "—",
      "Items you marked complete",
    ],
    [
      "Practice bank",
      PRACTICE_QUESTIONS.length,
      "Static learning material · not employer questions",
    ],
  ]) {
    const card = el("article", "panel");
    card.append(
      el("p", "eyebrow", title),
      el("strong", null, value),
      el("p", "helper", copy),
    );
    prep.append(card);
  }
  const rows = momentumSeries(next.data.applications),
    max = Math.max(1, ...rows.map((r) => r.count));
  bars.setAttribute("role", "img");
  bars.setAttribute(
    "aria-label",
    rows.map((r) => `${r.month}: ${r.count} records`).join("; "),
  );
  for (const row of rows) {
    const col = el("div", "momentum57-column");
    const bar = el("span", "momentum57-bar");
    bar.style.height =
      (row.count ? Math.max(5, (115 * row.count) / max) : 0) + "px";
    col.append(
      el("strong", null, row.count),
      bar,
      el("span", null, row.month.slice(5)),
    );
    bars.append(col);
  }
  const details = $("#momentum57Data");
  details.querySelectorAll("p").forEach((p) => p.remove());
  details.append(
    el("p", "helper", rows.map((r) => `${r.month}: ${r.count}`).join(" · ")),
    el(
      "p",
      "helper",
      "Only valid saved application dates are counted; undated records and dates outside this range are excluded. Counts describe tracked records, including Saved, not hiring outcomes.",
    ),
  );
  const move = careerNextStep(next.data);
  step.append(
    el("p", "eyebrow", "YOUR NEXT STEP"),
    el("h2", null, move.title),
    el("p", "helper", move.detail),
    el("p", "helper", move.source),
    link("Continue your next step", move.view),
  );
  const summary = interviewSnapshot(next.data.applications);
  snapshot.append(
    el(
      "div",
      "snapshot57-number",
      summary.percent === null ? "—" : summary.percent + "%",
    ),
    el("div", null, "All-records interview-stage snapshot"),
  );
  snapshot.lastChild.append(
    el(
      "p",
      "helper",
      `${summary.reached} currently Interview, Offer or Hired / ${summary.submitted} non-Saved records. This is a current-status ratio, not a historical interview conversion rate.`,
    ),
  );
}
