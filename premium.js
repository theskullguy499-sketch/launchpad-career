// Launchpad 5.1 presentation layer. Never owns persisted state or entitlements.
import { companies } from "./data/companies.mjs";
import { companyMarks } from "./data/company-marks.mjs";
const $ = (s) => document.querySelector(s);
const node = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = String(text);
  return el;
};
const icons = {
  arrow: "M5 19 19 5M5 5h14v14",
  briefcase: "M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3",
  target: "M21 12a9 9 0 1 1-9-9M12 7a5 5 0 1 0 5 5M12 12l9-9M17 3h4v4",
  calendar: "M3 5h18v16H3zM7 3v4M17 3v4M3 10h18M7 14h3M14 14h3",
  spark: "m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z",
  building: "M5 21V3h14v18M2 21h20M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-5h4v5",
};
export function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", icons[name] || icons.arrow);
  svg.append(path);
  return svg;
}
const link = (label, view, cls = "button button-outline") => {
  const a = node("a", cls, label);
  a.href = "#" + view;
  return a;
};
export function companyIdentity(name, identity) {
  const badge = node("span", "employer-mark");
  badge.setAttribute("aria-hidden", "true");
  const match = companies.find(
    (c) => c.name.toLowerCase() === String(name).trim().toLowerCase(),
  );
  const trusted =
    match &&
    (!identity ||
      (match.id === identity.id && match.website === identity.website));
  if (trusted && companyMarks.has(match.id)) {
    const img = node("img");
    img.src = `assets/companies/${match.id}.svg`;
    img.alt = "";
    img.width = 24;
    img.height = 24;
    img.addEventListener(
      "error",
      () => badge.replaceChildren(icon("building")),
      { once: true },
    );
    badge.append(img);
  } else badge.append(icon("building"));
  return badge;
}
export function decorateApplicationRows() {
  const visible = window.launchpadData?.visible() || [];
  for (const [index, row] of [
    ...document.querySelectorAll("#applicationsBody tr"),
  ].entries()) {
    const cell = row.firstElementChild;
    if (!cell || cell.querySelector(".employer-mark")) continue;
    const name = cell.querySelector("strong")?.textContent;
    const content = node("span", "employer-name");
    content.append(...cell.childNodes);
    const app = visible[index];
    if (app) {
      const salary =
        app.salaryMin || app.salaryMax
          ? `${app.currency || "USD"} ${app.salaryMin || "—"}–${app.salaryMax || "—"} / ${app.salaryPeriod || "Year"}`
          : "";
      const detail = [
        app.arrangement && app.arrangement !== "Unspecified"
          ? app.arrangement
          : "",
        app.priority ? app.priority + " priority" : "",
        salary,
      ]
        .filter(Boolean)
        .join(" · ");
      if (detail) content.append(node("small", "application-detail", detail));
    }
    const wrapper = node("span", "employer-cell");
    wrapper.append(companyIdentity(name), content);
    cell.append(wrapper);
  }
}
let initialized = false;
function initialize() {
  if (initialized) return;
  initialized = true;
  const dashboard = $("#dashboardView");
  dashboard.querySelector(".screen-heading").classList.add("dashboard-heading");
  const hero = node("section", "ascent-hero");
  hero.setAttribute("aria-labelledby", "ascentTitle");
  const copy = node("div", "ascent-copy");
  copy.append(
    node("p", "hero-kicker", "YOUR NEXT CHAPTER STARTS WITH A STEP"),
    node("h2", null, "Make progress. Build possibility."),
  );
  copy.querySelector("h2").id = "ascentTitle";
  copy.append(
    node(
      "p",
      null,
      "Keep your opportunities, learning and ambitions moving in the same direction.",
    ),
  );
  const actions = node("div", "button-row");
  actions.append(
    link("Shape your roadmap", "roadmap", "button hero-button"),
    link("Explore employers", "companies", "hero-link"),
  );
  copy.append(actions);
  const art = node("img", "ascent-art");
  art.src = "assets/career-ascent.svg";
  art.alt = "";
  art.width = 520;
  art.height = 340;
  hero.append(copy, art);
  dashboard.insertBefore(hero, $("#onboardingCard"));
  const bento = node("div", "dashboard-bento");
  for (const [id, title] of [
    ["dashboardJourney", "Your career trajectory"],
    ["dashboardActivity", "Recent applications"],
    ["dashboardFocus", "A useful next step"],
    ["dashboardCoach", "Think it through with your coach"],
  ]) {
    const section = node("section", "panel section-pad " + id);
    section.append(node("h2", null, title), node("div", "widget-content"));
    section.id = id;
    bento.append(section);
  }
  $("#dashboardMetrics").after(bento);
  // A toggle changes presentation only; favorites/search remain in their existing store.
  const toggle = node("div", "directory-view-toggle button-row");
  toggle.setAttribute("role", "group");
  toggle.setAttribute("aria-label", "Company display");
  for (const mode of ["grid", "list"]) {
    const b = node(
      "button",
      "button button-outline",
      mode === "grid" ? "Grid view" : "List view",
    );
    b.type = "button";
    b.setAttribute("aria-pressed", String(mode === "grid"));
    b.addEventListener("click", () => {
      $("#companyList").classList.toggle("directory-list", mode === "list");
      for (const button of toggle.children)
        button.setAttribute("aria-pressed", String(button === b));
    });
    toggle.append(b);
  }
  $("#companyCount").before(toggle);
  const source = node(
    "p",
    "helper brand-source",
    "Brand marks are sourced from Simple Icons; trademarks belong to their owners. A neutral symbol is used when a suitable local asset is unavailable. No affiliation or hiring status is implied.",
  );
  $("#companyList").after(source);
  const prompts = node("div", "coach-suggestions button-row");
  for (const [label, prompt] of [
    [
      "Plan my week",
      "Help me create a realistic weekly learning plan. Ask about my target role and available time first.",
    ],
    [
      "Prepare for an interview",
      "Help me prepare for a technical interview. Ask which role and skills I want to practice.",
    ],
    [
      "Review a project",
      "Help me improve a portfolio project description. Ask me to share a draft without sensitive information.",
    ],
  ]) {
    const b = node("button", "button button-outline", label);
    b.type = "button";
    b.addEventListener("click", () => {
      $("#coachPrompt").value = prompt;
      $("#coachPrompt").focus();
    });
    prompts.append(b);
  }
  $("#coachForm").prepend(prompts);
}
export function renderPremiumDashboard(data, stats) {
  initialize();
  const h1 = $("#dashboardView h1");
  h1.textContent = data.profile?.display_name
    ? `Welcome back, ${data.profile.display_name}.`
    : "A little clarity. A bigger horizon.";
  h1.classList.add("personal-welcome");
  const metrics = $("#dashboardMetrics").children;
  [...metrics].forEach((card, i) => {
    card.prepend(icon(["briefcase", "arrow", "calendar", "spark"][i]));
  });
  const journey = $("#dashboardJourney .widget-content");
  journey.replaceChildren();
  const complete = data.milestones.filter((m) => m.completed).length;
  const total = data.milestones.length,
    percent = total ? Math.round((100 * complete) / total) : 0;
  const ring = node("div", "trajectory-ring");
  ring.style.setProperty("--progress", `${percent}%`);
  ring.append(
    node("strong", null, `${percent}%`),
    node("span", null, "complete"),
  );
  const detail = node("div", "trajectory-detail");
  detail.append(
    node("h3", null, data.goals[0]?.targetRole || "Choose your direction"),
    node("p", "helper", `${complete} of ${total} personal milestones complete`),
    link(
      total ? "Continue your roadmap" : "Build your first roadmap",
      "roadmap",
    ),
  );
  journey.append(ring, detail);
  const recent = $("#dashboardActivity .widget-content");
  recent.replaceChildren();
  const apps = data.applications
    .map((a, i) => ({ a, i }))
    .sort(
      (x, y) =>
        String(y.a.applicationDate || "").localeCompare(
          String(x.a.applicationDate || ""),
        ) || y.i - x.i,
    )
    .slice(0, 3);
  if (!apps.length)
    recent.append(
      node(
        "p",
        "empty-copy",
        "Your next opportunity belongs here. Add an application to start your own activity feed.",
      ),
    );
  for (const { a } of apps) {
    const row = node("div", "activity-row");
    const text = node("div");
    text.append(node("strong", null, a.company), node("p", "helper", a.role));
    row.append(
      companyIdentity(a.company),
      text,
      node("span", `status-pill status-${a.status}`, a.status),
    );
    recent.append(row);
  }
  recent.append(link("View all applications", "applications", "text-link"));
  const focus = $("#dashboardFocus .widget-content");
  focus.replaceChildren();
  const next = data.tasks.find((t) => !t.completed);
  focus.append(
    icon("target"),
    node(
      "h3",
      null,
      next?.title ||
        (data.goals.length
          ? "Turn your goal into one weekly action."
          : "Start with your north star."),
    ),
    node(
      "p",
      "helper",
      next?.dueDate
        ? `Target date: ${next.dueDate}`
        : "A small, specific commitment is easier to follow through.",
    ),
    link(
      next ? "Review your tasks" : "Define your next milestone",
      next ? "dashboard" : "roadmap",
    ),
  );
  if (next)
    focus.lastChild.addEventListener("click", () =>
      $("#taskList").scrollIntoView({ block: "center" }),
    );
  const coach = $("#dashboardCoach .widget-content");
  coach.replaceChildren();
  coach.append(
    icon("spark"),
    node(
      "p",
      null,
      "A fresh perspective on skills, interviews and your next career move.",
    ),
    node(
      "p",
      "helper",
      "Requires a verified account and configured AI service. Context is shared only with your consent.",
    ),
    link("Open career coach", "coach", "button button-primary"),
  );
  // This progress element is derived only from personal milestones, not sample data.
  let progress = $("#personalJourneyBar");
  if (!progress) {
    progress = node("progress");
    progress.id = "personalJourneyBar";
    progress.max = 100;
    progress.setAttribute("aria-label", "Personal roadmap completion");
    $("#personalProgress").after(progress);
  }
  progress.value = percent;
}
