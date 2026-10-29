// Launchpad workspace presentation. Data changes use existing owned controllers only.
import {
  applicationHistory,
  applicationSchedule,
  nextApplicationAction,
  datedMonths,
  safeCompanyLink,
} from "./lib/workspace-insights.mjs";
import { companyIdentity, icon } from "./premium.js";
const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = String(text);
  return n;
};
const button = (text, handler, cls = "button button-outline") => {
  const b = el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", handler);
  return b;
};
let initialized = false,
  context = null,
  calendarMode = false,
  detailId = null;
const localNow = new Date();
let month =
  localNow.getFullYear() +
  "-" +
  String(localNow.getMonth() + 1).padStart(2, "0");
function panel(title, cls = "") {
  const p = el("section", "panel section-pad " + cls);
  p.append(el("h2", null, title));
  return p;
}
function link(text, href) {
  const a = el("a", "text-link", text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}
let dialog;
function openDetail(title) {
  dialog ||= (() => {
    const d = el("dialog", "application-dialog workspace-detail-dialog");
    d.id = "workspaceDetailDialog";
    d.setAttribute("aria-labelledby", "workspaceDetailTitle");
    document.body.append(d);
    return d;
  })();
  dialog.replaceChildren();
  const head = el("div", "dialog-head");
  const h = el("h2", null, title);
  h.id = "workspaceDetailTitle";
  head.append(
    h,
    button("×", () => dialog.close(), "icon-btn"),
  );
  head.lastChild.setAttribute("aria-label", "Close workspace details");
  dialog.append(head);
  return dialog;
}
export function viewApplicationHistory(app) {
  detailId = app.id;
  const d = openDetail(app.role);
  d.append(
    companyIdentity(app.company),
    el("p", "eyebrow", app.company),
    el("p", "helper", `${app.status} · ${nextApplicationAction(app)}`),
    el("h3", null, "Update history"),
  );
  const entries = applicationHistory(app.updates);
  if (!entries.length)
    d.append(
      el(
        "p",
        "empty-copy",
        "No recorded updates yet. Existing records were preserved; earlier changes have not been reconstructed.",
      ),
    );
  const list = el("ol", "application-update-list");
  for (const item of [...entries].reverse()) {
    const row = el("li");
    row.append(
      el("strong", null, item.summary),
      el("time", null, new Date(item.at).toLocaleString("en-US")),
    );
    list.append(row);
  }
  d.append(
    list,
    el(
      "p",
      "helper",
      "The most recent 20 recorded changes are retained with this opportunity. This is user-owned history, not a tamper-proof security audit log.",
    ),
    button(
      "Edit opportunity",
      () => {
        d.close();
        window.launchpadData.openForm(app);
      },
      "button button-primary",
    ),
  );
  if (!d.open) d.showModal();
}
function companyDetail(company) {
  if (!context) return;
  detailId = "company:" + company.id;
  const d = openDetail(company.name);
  d.append(
    companyIdentity(company.name, company),
    el(
      "p",
      "helper",
      `${company.industry || "Industry not supplied"} · ${company.country || "Country not verified"}`,
    ),
    el(
      "p",
      "helper",
      company.source === "User supplied"
        ? "Company information was entered by you. Verify links and details before sharing personal data."
        : "Curated employer directory entry. Brand marks belong to their owners. No affiliation, hiring status, company size or vacancies are implied.",
    ),
  );
  for (const [label, url] of [
    ["Company website", company.website],
    ["Careers page", company.careersUrl],
  ])
    if (safeCompanyLink(url)) d.append(link(label, safeCompanyLink(url)));
  const rows = context.data.applications.filter(
    (a) => a.company.toLowerCase() === company.name.toLowerCase(),
  );
  d.append(el("h3", null, `${rows.length} tracked applications`));
  if (!rows.length)
    d.append(
      el(
        "p",
        "empty-copy",
        "No opportunities tracked for this company yet. Add an opportunity after verifying its original listing.",
      ),
    );
  for (const app of rows) {
    const row = el("article", "company-related-application");
    row.append(
      el("strong", null, app.role),
      el("span", "status-pill status-" + app.status, app.status),
      el("p", "helper", nextApplicationAction(app)),
      button("Review opportunity", () => viewApplicationHistory(app)),
    );
    d.append(row);
  }
  if (!d.open) d.showModal();
}
export function clearWorkspace54() {
  context = null;
  if ($("#settingsStatus")) $("#settingsStatus").textContent = "";
  calendarMode = false;
  detailId = null;
  if (dialog?.open) dialog.close();
  dialog?.replaceChildren();
  for (const id of ["coachQuestionPreview", "profileFeedback"])
    if ($("#" + id)) $("#" + id).textContent = "";
  if ($("#analyticsPeriod")) $("#analyticsPeriod").value = "all";
  if ($("#milestoneKind")) $("#milestoneKind").value = "all";
  if ($("#milestoneSearch")) $("#milestoneSearch").value = "";
  if ($("#coachView")) $("#coachView").dataset.coachState = "idle";
}
function initialize() {
  if (initialized) return;
  initialized = true;
  window.launchpadWorkspace54 = Object.freeze({
    history: viewApplicationHistory,
    company: companyDetail,
  });
  window.addEventListener("launchpad:render", () =>
    queueMicrotask(() => {
      if (context) renderApplicationView();
    }),
  );
  // Application views and an agenda backed by actual saved dates.
  const toolbar = $(".tracker-view-actions");
  const calendar = button("Calendar", () => {
    calendarMode = true;
    context?.rerender();
  });
  calendar.id = "calendarViewBtn";
  calendar.setAttribute("aria-pressed", "false");
  toolbar.prepend(calendar);
  for (const id of ["tableViewBtn", "boardViewBtn"])
    $("#" + id).addEventListener("click", () => {
      calendarMode = false;
      $("#tableViewBtn").setAttribute(
        "aria-pressed",
        String(id === "tableViewBtn"),
      );
      $("#boardViewBtn").setAttribute(
        "aria-pressed",
        String(id === "boardViewBtn"),
      );
      context?.rerender();
    });
  const agenda = panel("Your application calendar", "applications-agenda");
  agenda.id = "applicationsAgenda";
  agenda.hidden = true;
  const controls = el("div", "agenda-controls"),
    label = el("label", null, "Calendar month");
  const input = el("input");
  input.type = "month";
  input.id = "applicationMonth";
  input.value = month;
  input.min = "1900-01";
  input.max = "2200-12";
  input.addEventListener("change", () => {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(input.value)) {
      month = input.value;
      renderAgenda();
    }
  });
  label.append(input);
  controls.append(
    label,
    el(
      "p",
      "helper",
      "Interviews, deadlines and follow-ups from the current workspace. No reminders run while the browser is closed.",
    ),
  );
  agenda.append(controls, el("div", "application-month-content"));
  $("#kanbanBoard").before(agenda);
  $("#kanbanBoard").tabIndex = 0;
  $("#kanbanBoard").setAttribute("role", "region");
  const hint = el(
    "p",
    "helper kanban-scroll-hint",
    "Scroll within the board to explore all stages. Use Move to stage for keyboard and touch updates.",
  );
  hint.id = "kanbanScrollHint";
  $("#kanbanBoard").before(hint);
  const intro = $("#applicationsView .page-intro");
  intro.querySelector("h1").textContent = "Your applications.";
  intro.querySelector(".intro-copy").textContent =
    "A clear next step for every opportunity.";
  intro.querySelector(".hero-decoration")?.remove();
  const overview = $("#applicationsView > .section-head");
  intro.append($("#addApplicationBtn"));
  overview.remove();
  // Group existing editor inputs; no field, validation or saved value is replaced.
  const grid = $("#applicationForm > .form-grid");
  const groups = [
    [
      "Role & company",
      ["company", "role", "country", "location", "arrangement", "url"],
    ],
    ["Compensation", ["salaryMin", "salaryMax", "currency", "salaryPeriod"]],
    [
      "Dates & next actions",
      [
        "status",
        "priority",
        "applicationDate",
        "deadline",
        "interviewAt",
        "followUp",
      ],
    ],
    ["Your notes", ["notes"]],
  ];
  const sections = el("div", "application-form-sections");
  for (const [title, ids] of groups) {
    const f = el("fieldset");
    f.append(el("legend", null, title));
    const fields = el("div", "form-grid");
    for (const id of ids) fields.append($("#" + id).closest("label"));
    f.append(fields);
    sections.append(f);
  }
  // Preserve non-label controls such as the company datalist when grouping fields.
  sections.append(...grid.children);
  grid.replaceWith(sections);
  // Roadmap: keep the original starter checklist and all personal milestones.
  const roadmap = $("#roadmapView"),
    personal = $(".personal-plan");
  const summary = panel("Your career, in motion", "roadmap-studio-hero");
  summary.id = "roadmapStudioSummary";
  personal.before(summary);
  const filter = el("div", "milestone-tools");
  const search = el("label", null, "Search milestones");
  const text = el("input");
  text.id = "milestoneSearch";
  text.type = "search";
  text.maxLength = 200;
  text.placeholder = "A skill, project or next step";
  search.append(text);
  const kindLabel = el("label", null, "Stage");
  const kind = el("select");
  kind.id = "milestoneKind";
  kind.append(new Option("All stages", "all"));
  kindLabel.append(kind);
  filter.append(search, kindLabel);
  $("#personalMilestones").before(filter);
  for (const field of [text, kind])
    field.addEventListener("input", filterMilestones);
  // Analytics filters read saved application dates, never forecast outcomes.
  const period = el("label", "analytics-period-label", "Application period");
  const select = el("select");
  select.id = "analyticsPeriod";
  for (const [v, t] of [
    ["all", "All records"],
    ["30", "Last 30 days"],
    ["90", "Last 90 days"],
    ["365", "Last 365 days"],
  ])
    select.append(new Option(t, v));
  select.addEventListener("change", () => context?.rerender());
  period.append(select);
  $("#analyticsView .screen-heading").append(period);
  const trend = panel("Applications over time", "analytics-trend-panel");
  trend.id = "analyticsDatedTrend";
  $("#analyticsCharts").before(trend);
  // Conversation structure uses the existing provider result and consent controls.
  const form = $("#coachForm"),
    old = form.parentElement,
    response = $("#coachResponse").closest("section");
  const coach = el("div", "coach-workspace");
  old.before(coach);
  const sidebar = panel("Your saved exchanges", "coach-sidebar");
  const main = el("div", "coach-main");
  coach.append(sidebar, main);
  const fresh = button("New conversation", () => {
    if (form.getAttribute("aria-busy") === "true") return;
    $("#coachPrompt").value = "";
    $("#coachResponse").textContent = "";
    $("#coachQuestionPreview").textContent = "";
    $("#coachView").dataset.coachState = "idle";
    $("#coachPrompt").focus();
  });
  fresh.id = "newCoachConversation";
  sidebar.append(
    fresh,
    el(
      "p",
      "helper",
      "History is saved only when you choose. Opening an exchange does not send it to AI.",
    ),
    $("#coachHistory"),
  );
  main.append(response, form);
  if (!old.children.length) old.remove();
  for (const h of [...response.querySelectorAll("h3")])
    if (h.textContent === "Saved history") {
      const p = h.nextElementSibling;
      if (p?.tagName === "P") p.remove();
      h.remove();
    }
  response.classList.add("coach-conversation");
  response.querySelector("h2").textContent = "Your conversation";
  const question = el("p", "coach-user-message");
  question.id = "coachQuestionPreview";
  $("#coachResponse").before(question);
  const welcome = el("div", "coach-welcome");
  welcome.id = "coachWelcome";
  const art = el("img");
  art.src = "assets/workspace-path.svg";
  art.alt = "";
  art.width = 300;
  art.height = 190;
  welcome.append(
    art,
    el("h3", null, "A little perspective for your next chapter."),
    el(
      "p",
      "helper",
      "Choose a suggestion or write a question. A real response requires the configured provider, a verified account and available credits.",
    ),
  );
  question.before(welcome);
  const loading = el(
    "p",
    "coach-loading",
    "Waiting for the configured AI provider…",
  );
  loading.id = "coachLoading";
  $("#coachResponse").before(loading);
  const fieldset = form.querySelector("fieldset");
  const contextSettings = el("details", "coach-context-settings");
  contextSettings.open = true;
  contextSettings.append(
    el("summary", null, "Shared context & privacy"),
    fieldset,
  );
  form.querySelector("label").after(contextSettings);
  const observe = () => {
    const busy = form.getAttribute("aria-busy") === "true";
    fresh.disabled = busy;
    welcome.hidden = Boolean(
      $("#coachResponse").textContent || question.textContent || busy,
    );
    question.hidden = !question.textContent;
  };
  new MutationObserver(observe).observe(response, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  new MutationObserver(observe).observe(form, {
    attributes: true,
    attributeFilter: ["aria-busy"],
  });
  observe();
  // Settings categories are anchor navigation: all existing controls stay available.
  mountSettings();
}
function mountSettings() {
  const root = $("#settingsView"),
    form = $("#profileForm"),
    privacy = $("#privacyActions").closest("section"),
    old = form.parentElement;
  const work = el("div", "settings-workbench"),
    nav = el("nav", "settings-category-nav"),
    content = el("div", "settings-category-content");
  nav.setAttribute("aria-label", "Settings categories");
  root.querySelector(".screen-heading").after(work);
  work.append(nav, content);
  const account = panel("Account", "settings-category"),
    security = panel("Security", "settings-category"),
    notifications = panel("Notifications", "settings-category"),
    data = panel("Data & Export", "settings-category"),
    subscription = panel("Subscription", "settings-category"),
    appearance = panel("Appearance", "settings-category");
  const deletion = privacy.querySelector("h3");
  while (deletion.nextSibling) security.append(deletion.nextSibling);
  deletion.remove();
  account.append(
    el(
      "p",
      "helper",
      "Supabase is the authority for sign-in and email confirmation. Account and guest workspaces remain separate.",
    ),
    el("p", "account-workspace-description"),
    button("Open account controls", () => $("#accountBtn").click()),
  );
  security.prepend(
    el(
      "p",
      "helper",
      "Recovery uses the existing email-link flow: sign out in Account, then choose Forgot password. Account deletion below requires password reauthentication.",
    ),
  );
  const email = $("#emailPreference");
  email.setAttribute("form", "profileForm");
  const label = email.closest("label"),
    help = label.nextElementSibling;
  notifications.append(label);
  if (help?.tagName === "P") notifications.append(help);
  const save = el(
    "button",
    "button button-primary",
    "Save notification preference",
  );
  save.type = "submit";
  save.setAttribute("form", "profileForm");
  notifications.append(save);
  const history = $("#historyPreference");
  history.setAttribute("form", "profileForm");
  privacy.append(history.closest("label"));
  const saveHistory = el(
    "button",
    "button button-outline",
    "Save privacy preference",
  );
  saveHistory.type = "submit";
  saveHistory.setAttribute("form", "profileForm");
  privacy.append(saveHistory);
  for (const b of [...$("#privacyActions").children])
    if (/Export all|Import guest/.test(b.textContent)) data.append(b);
  data.prepend(
    el(
      "p",
      "helper",
      "Exports use the current workspace. Guest import and JSON replacement require explicit confirmation. Keep a backup before changing records.",
    ),
  );
  data.append(
    button("Download JSON backup", () => $("#backupBtn").click()),
    button("Restore JSON backup", () => $("#restoreFile").click()),
    button("Export applications CSV", () => $("#exportBtn").click()),
  );
  // commerce.js can initialize after this module; relocate its existing live
  // summary, preserving the node and all billing listeners rather than duplicating it.
  const relocateBillingSummary = () => {
    const summaryPanel = $("#commercialSettingsSummary")?.closest("section");
    if (summaryPanel && summaryPanel.parentElement !== subscription)
      subscription.append(summaryPanel);
  };
  new MutationObserver(relocateBillingSummary).observe(root, {
    childList: true,
  });
  relocateBillingSummary();
  subscription.append(
    el("p", "settings-plan-description"),
    button("Open Plans & Billing", () =>
      window.launchpadData.navigate("billing"),
    ),
    el(
      "p",
      "helper",
      "Plan permissions are confirmed by the server. This page does not grant access or initiate a purchase.",
    ),
  );
  const theme = button("Use dark theme", () => $("#themeToggle").click());
  theme.id = "settingsThemeToggle";
  appearance.append(
    el(
      "p",
      "helper",
      "Theme is saved in this browser. System reduced-motion preferences are respected.",
    ),
    theme,
  );
  const sync = () => {
    const dark = document.body.classList.contains("dark");
    theme.textContent = dark ? "Use light theme" : "Use dark theme";
    theme.setAttribute("aria-pressed", String(dark));
  };
  new MutationObserver(sync).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  sync();
  const feedback = $("#feedbackForm"),
    legal = $("#legalLinks").closest("section");
  const groups = [
    ["profile", "Profile", form],
    ["account", "Account", account],
    ["security", "Security", security],
    ["privacy", "Privacy", privacy],
    ["notifications", "Notifications", notifications],
    ["data", "Data & Export", data],
    ["subscription", "Subscription", subscription],
    ["appearance", "Appearance", appearance],
  ];
  for (const [id, title, section] of groups) {
    section.id = id === "profile" ? "profileForm" : "settings-" + id;
    section.dataset.category = id;
    section.tabIndex = -1;
    section.classList.add("settings-category");
    if (id === "privacy") section.querySelector("h2").textContent = "Privacy";
    const a = el("a", null, title);
    a.href = "#settings?section=" + id;
    a.addEventListener("click", () => requestAnimationFrame(scrollSettings));
    nav.append(a);
    content.append(section);
  }
  content.append(feedback, legal);
  if (!old.children.length) old.remove();
  const feedbackStatus = el("p", "helper");
  feedbackStatus.id = "profileFeedback";
  feedbackStatus.setAttribute("role", "status");
  form.append(feedbackStatus);
  new MutationObserver(() => {
    feedbackStatus.textContent = $("#settingsStatus").textContent;
  }).observe($("#settingsStatus"), {
    childList: true,
    subtree: true,
    characterData: true,
  });
  const syncMirrors = () => {
    const plan =
      $("#dashboardPlanStatus")?.textContent ||
      "Plan not yet verified. Open Plans & Billing to check the server.";
    const workspace =
      $("#workspaceLabel").textContent + " · " + $("#syncStatus").textContent;
    if ($(".settings-plan-description").textContent !== plan)
      $(".settings-plan-description").textContent = plan;
    if ($(".account-workspace-description").textContent !== workspace)
      $(".account-workspace-description").textContent = workspace;
  };
  for (const root of [$("#dashboardView"), $(".workspace-bar")])
    new MutationObserver(syncMirrors).observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  syncMirrors();
  window.addEventListener("hashchange", scrollSettings);
  requestAnimationFrame(scrollSettings);
}
function scrollSettings() {
  const [route, params = ""] = location.hash.slice(1).split("?");
  if (route !== "settings") return;
  const key = new URLSearchParams(params).get("section");
  const section = [...document.querySelectorAll(".settings-category")].find(
    (e) => e.dataset.category === key,
  );
  if (!section) return;
  section.scrollIntoView({ block: "start", behavior: "auto" });
  section.focus({ preventScroll: true });
  for (const a of document.querySelectorAll(".settings-category-nav a")) {
    if (a.hash.endsWith("section=" + key))
      a.setAttribute("aria-current", "location");
    else a.removeAttribute("aria-current");
  }
}
function renderAgenda() {
  if (!context) return;
  const root = $(".application-month-content");
  root.replaceChildren();
  const events = applicationSchedule(window.launchpadData.visible());
  const selected = events.filter((x) => x.date.startsWith(month));
  const [year, m] = month.split("-").map(Number),
    start = (new Date(year, m - 1, 1).getDay() + 6) % 7,
    last = new Date(year, m, 0).getDate();
  const table = el("table", "workspace-month-grid");
  table.append(
    el(
      "caption",
      null,
      new Date(year, m - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    ),
  );
  const thead = el("thead"),
    head = el("tr");
  for (const name of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    const th = el("th", null, name);
    th.scope = "col";
    head.append(th);
  }
  thead.append(head);
  const body = el("tbody");
  for (let i = 0; i < Math.ceil((start + last) / 7) * 7; i += 7) {
    const row = el("tr");
    for (let j = 0; j < 7; j++) {
      const cell = el("td"),
        day = i + j - start + 1;
      if (day >= 1 && day <= last) {
        const date = month + "-" + String(day).padStart(2, "0"),
          items = selected.filter((x) => x.date === date);
        const time = el("time", items.length ? "has-event" : null, day);
        time.dateTime = date;
        time.setAttribute(
          "aria-label",
          date + (items.length ? `, ${items.length} planned items` : ""),
        );
        cell.append(time);
      }
      row.append(cell);
    }
    body.append(row);
  }
  table.append(thead, body);
  root.append(table);
  const list = el("div", "application-agenda-list");
  if (!selected.length)
    list.append(
      el(
        "p",
        "empty-copy",
        "No dated interviews, deadlines or follow-ups for this month and the current filters. Edit an opportunity to add your next action.",
      ),
    );
  for (const item of selected.slice(0, 200)) {
    const row = el("article", "agenda-event");
    row.append(
      el("time", null, item.date),
      el("span", "agenda-event-kind", item.kind),
      el("strong", null, item.company),
      el("p", "helper", item.role),
      button("Review", () =>
        viewApplicationHistory(
          context.data.applications.find((a) => a.id === item.id),
        ),
      ),
    );
    list.append(row);
  }
  if (selected.length > 200)
    list.append(
      el(
        "p",
        "helper",
        `Showing 200 of ${selected.length} planned items. Narrow your application filters.`,
      ),
    );
  root.append(list);
}
function filterMilestones() {
  const q = $("#milestoneSearch").value.toLowerCase().trim(),
    kind = $("#milestoneKind").value;
  for (const row of document.querySelectorAll("#personalMilestones .list-item"))
    row.hidden = !(
      row.textContent.toLowerCase().includes(q) &&
      (kind === "all" || row.dataset.kind === kind)
    );
}
function renderRoadmap() {
  const data = context.data,
    done = data.milestones.filter((x) => x.completed).length,
    total = data.milestones.length,
    percent = total ? Math.round((100 * done) / total) : 0;
  const root = $("#roadmapStudioSummary");
  root.replaceChildren();
  const main = el("div");
  main.append(
    el("p", "eyebrow", "A JOURNEY YOU CAN SHAPE"),
    el(
      "h2",
      null,
      data.goals[0]?.targetRole || "Give your next chapter a direction.",
    ),
    el(
      "p",
      "helper",
      total
        ? `${done} of ${total} personal milestones complete. Your original starter checklist remains available below.`
        : "Add a career goal and your own milestones. Existing plans and the starter checklist are preserved.",
    ),
  );
  const ring = el("div", "workspace-progress-ring");
  ring.style.setProperty("--completion", percent + "%");
  ring.append(
    el("strong", null, percent + "%"),
    el("span", null, "personal plan"),
  );
  const skills = el("div", "roadmap-focus-skills");
  for (const skill of [
    ...new Set(data.goals.flatMap((x) => x.skills || [])),
  ].slice(0, 20))
    skills.append(el("span", null, skill));
  main.append(skills);
  const next = [...data.milestones]
    .filter((x) => !x.completed)
    .sort((a, b) =>
      (a.targetDate || "9999").localeCompare(b.targetDate || "9999"),
    )[0];
  const aside = el("div", "roadmap-next-step");
  aside.append(
    el("p", "eyebrow", "YOUR NEXT MILESTONE"),
    el("h3", null, next?.title || "Start with one small commitment."),
    el(
      "p",
      "helper",
      next?.targetDate
        ? "Target date: " + next.targetDate
        : "Set a date that works for your own pace.",
    ),
  );
  if (next)
    aside.append(
      button("Edit next milestone", () => context.editMilestone(next)),
    );
  else
    aside.append(
      button("Create your plan", () =>
        $("#roadmapActions").querySelector("button").click(),
      ),
    );
  root.append(ring, main, aside);
  const select = $("#milestoneKind"),
    value = select.value;
  select.replaceChildren(
    new Option("All stages", "all"),
    ...[...new Set(data.milestones.map((m) => m.kind || "Milestone"))]
      .sort()
      .map((v) => new Option(v, v)),
  );
  select.value = [...select.options].some((o) => o.value === value)
    ? value
    : "all";
  for (const [i, row] of [...$("#personalMilestones").children].entries()) {
    row.dataset.kind = data.milestones[i]?.kind || "Milestone";
    row.dataset.position = String(i + 1);
  }
  filterMilestones();
}
function renderAnalytics() {
  const { periodData, periodStats } = context,
    rows = datedMonths(periodData.applications);
  const root = $("#analyticsDatedTrend");
  root.replaceChildren(
    el("p", "eyebrow", "YOUR RECORDED APPLICATION DATES"),
    el("h2", null, "Applications over time"),
  );
  const undated = periodData.applications.filter(
    (a) => !/^\d{4}-\d{2}-\d{2}$/.test(a.applicationDate || ""),
  ).length;
  root.append(
    el(
      "p",
      "helper",
      `Period filters use application dates only; undated records are included only in All records. ${undated} selected records have no application date. Current status and interview counts describe those records, not the dates of later outcomes.`,
    ),
  );
  if (!rows.length) {
    root.append(
      el(
        "div",
        "analytics-empty-plot",
        "Your dated activity will take shape here.",
      ),
      el(
        "p",
        "empty-copy",
        "Add an application date to a tracked opportunity. No example trend or invented growth rate is shown.",
      ),
    );
  } else {
    const chart = el("div", "monthly-application-bars");
    chart.setAttribute("role", "img");
    chart.setAttribute(
      "aria-label",
      rows.map(([m, n]) => `${m}: ${n}`).join("; "),
    );
    const max = Math.max(...rows.map(([, n]) => n));
    for (const [month, count] of rows.slice(-12)) {
      const column = el("div", "monthly-application-column");
      const bar = el("span", "monthly-application-bar");
      bar.style.height = Math.max(4, (140 * count) / max) + "px";
      column.append(el("strong", null, count), bar, el("span", null, month));
      chart.append(column);
    }
    root.append(chart);
    if (rows.length > 12)
      root.append(
        el(
          "p",
          "helper",
          "Chart shows the last 12 reported months; all dated months are listed in the data table.",
        ),
      );
    const details = el("details"),
      summary = el("summary", null, "View monthly data");
    const table = el("table", "insights-data-table");
    table.append(el("caption", null, "Application dates by month"));
    const head = el("tr");
    for (const label of ["Month", "Applications"]) {
      const th = el("th", null, label);
      th.scope = "col";
      head.append(th);
    }
    const th = el("thead");
    th.append(head);
    table.append(th);
    const body = el("tbody");
    for (const [m, n] of rows) {
      const tr = el("tr");
      tr.append(el("td", null, m), el("td", null, n));
      body.append(tr);
    }
    table.append(body);
    details.append(summary, table);
    root.append(details);
  }
  const overview = $("#analyticsOverview");
  overview.querySelector("h2").textContent =
    "Your selected application pipeline.";
  overview.querySelector(".helper").textContent =
    `${periodStats.total} tracked records in this selection · ${periodStats.responseRate}% response rate by the definition above. No prediction or external benchmark is used.`;
  const distribution = overview.querySelector(".status-distribution");
  distribution.replaceChildren();
  distribution.setAttribute(
    "aria-label",
    periodStats.statuses.map(([s, n]) => `${s}: ${n}`).join("; ") ||
      "No tracked records in this period",
  );
  for (const [status, count] of periodStats.statuses) {
    const seg = el("span");
    seg.dataset.status = status;
    seg.style.flexGrow = String(count);
    seg.title = `${status}: ${count}`;
    distribution.append(seg);
  }
}
function decorateHistory() {
  const entries = context.data.aiHistory;
  for (const [i, details] of [...$("#coachHistory").children].entries()) {
    if (!details.matches("details") || !entries[i] || details.dataset.enhanced)
      continue;
    details.dataset.enhanced = "true";
    const item = entries[i];
    details.append(
      el(
        "p",
        "helper",
        item.createdAt
          ? `Saved: ${item.createdAt}`
          : "Saved exchange · date not supplied",
      ),
      button("Open exchange", () => {
        if ($("#coachForm").getAttribute("aria-busy") === "true") return;
        $("#coachQuestionPreview").textContent =
          item.prompt || "Saved question";
        $("#coachResponse").textContent =
          typeof item.response === "string"
            ? item.response
            : JSON.stringify(item.response, null, 2);
        $("#coachView").dataset.coachState = "history";
        $("#coachStatus").textContent =
          "Saved exchange opened. No new request or sharing took place.";
        $("#coachResponse").scrollIntoView({ block: "center" });
      }),
    );
  }
}
function renderApplicationView() {
  const visibleApplications = window.launchpadData.visible();
  $("#calendarViewBtn").setAttribute("aria-pressed", String(calendarMode));
  $("#applicationsAgenda").hidden = !calendarMode;
  $("#kanbanScrollHint").hidden = $("#kanbanBoard").hidden || calendarMode;
  if (
    !calendarMode &&
    $("#tableViewBtn").getAttribute("aria-pressed") === "true"
  ) {
    const visible = visibleApplications;
    $("#tableWrap").hidden = visible.length === 0;
    $("#kanbanBoard").hidden = true;
    $("#emptyState").hidden = context.data.applications.length !== 0;
    $("#noMatches").hidden =
      context.data.applications.length === 0 || visible.length !== 0;
  }
  if (calendarMode) {
    $("#tableWrap").hidden = true;
    $("#kanbanBoard").hidden = true;
    $("#emptyState").hidden = true;
    $("#noMatches").hidden = true;
    $("#tableViewBtn").setAttribute("aria-pressed", "false");
    $("#boardViewBtn").setAttribute("aria-pressed", "false");
    renderAgenda();
  }
  for (const [index, row] of [
    ...document.querySelectorAll("#applicationsBody tr"),
  ].entries()) {
    const app = visibleApplications[index];
    if (app && !row.dataset.enriched) {
      const cell = row.firstElementChild;
      cell.append(
        el("small", "application-next-line", nextApplicationAction(app)),
      );
      row.dataset.enriched = "true";
    }
  }
}
export function renderWorkspace54(next) {
  context = next;
  initialize();
  renderApplicationView();
  renderRoadmap();
  renderAnalytics();
  decorateHistory();
  $(".account-workspace-description").textContent =
    $("#workspaceLabel").textContent + " · " + $("#syncStatus").textContent;
  $(".settings-plan-description").textContent =
    $("#dashboardPlanStatus")?.textContent ||
    "Plan not yet verified. Open Plans & Billing to check the server.";
  if (dialog?.open && detailId && !detailId.startsWith("company:")) {
    const app = next.data.applications.find((a) => a.id === detailId);
    if (!app) dialog.close();
  }
}
