// Launchpad 5.2 presentation reads the active snapshot; storage and rights stay elsewhere.
import { reminders } from "./lib/model.mjs";
import { companyIdentity, icon } from "./premium.js";
const $ = (s) => document.querySelector(s);
const node = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = String(text);
  return e;
};
const link = (text, view, cls = "text-link") => {
  const a = node("a", cls, text);
  a.href = "#" + view;
  return a;
};
const svgNS = "http://www.w3.org/2000/svg";
function chart(points, label) {
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 320 94");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  svg.classList.add("activity-sparkline");
  const max = Math.max(1, ...points.map((p) => p[1])),
    steps = Math.max(1, points.length - 1);
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute(
    "d",
    points
      .map(
        (p, i) =>
          (i ? "L" : "M") +
          (8 + (i * 304) / steps) +
          "," +
          (82 - (p[1] * 64) / max),
      )
      .join(" "),
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "3");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  points.forEach((p, i) => {
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", 8 + (i * 304) / steps);
    dot.setAttribute("cy", 82 - (p[1] * 64) / max);
    dot.setAttribute("r", "4");
    dot.setAttribute("fill", "currentColor");
    svg.append(dot);
  });
  return svg;
}
let initialized = false;
function initialize() {
  if (initialized) return;
  initialized = true;
  for (const [index, badge] of [
    ...document.querySelectorAll("#applicationsView .stat-icon"),
  ].entries())
    badge.replaceChildren(
      icon(["briefcase", "arrow", "calendar", "spark"][index]),
    );
  document
    .querySelector("#emptyState .empty-icon")
    ?.replaceChildren(icon("arrow"));
  document
    .querySelector(".hero-decoration>span")
    ?.replaceChildren(icon("arrow"));
  const dashboard = $("#dashboardView"),
    heading = dashboard.querySelector(".screen-heading"),
    hero = dashboard.querySelector(".ascent-hero");
  const lead = node("div", "dashboard-lead-grid");
  hero.before(lead);
  lead.append(hero);
  const compass = node("section", "career-compass");
  compass.id = "careerCompass";
  compass.setAttribute("aria-label", "Your career direction");
  lead.append(compass);
  const bento = $(".dashboard-bento");
  // One editorial row for progress, momentum and coaching rather than repeated cards.
  const momentum = node("section", "panel section-pad momentum-card");
  momentum.id = "dashboardMomentum";
  bento.append(momentum);
  const schedule = node("section", "panel section-pad schedule-card");
  schedule.id = "dashboardSchedule";
  bento.append(schedule);
  bento.prepend($("#dashboardJourney"), $("#dashboardCoach"), momentum);
  bento.append(schedule, $("#dashboardFocus"));
  $("#dashboardCoach").classList.add("coach-feature-card");
  const activity = $("#dashboardActivity");
  activity.classList.add("activity-timeline-card");
  const strip = node("div", "dashboard-lower-grid");
  bento.after(strip);
  const tasks = $("#taskList").closest("section"),
    notices = $("#reminderList").closest("section"),
    favorites = $("#dashboardCompanies").closest("section");
  const previous = tasks.parentElement;
  strip.append(tasks, notices, favorites);
  if (!previous.children.length) previous.remove();
  const onboarding = $("#onboardingCard");
  heading.after(onboarding);
  onboarding.classList.add("onboarding-ribbon");
  const heroTitle = $("#ascentTitle");
  heroTitle.textContent = "Build a career with direction.";
  hero.querySelector(".ascent-copy>p:not(.hero-kicker)").textContent =
    "A thoughtful plan. The right opportunities. Your next chapter, in motion.";
  hero.querySelector(".ascent-art").src = "assets/career-studio.svg";
  const intro = dashboard.querySelector(".intro-copy");
  intro.textContent =
    "Your personal career studio. Every number and next step starts with your own progress.";
  // A compact story panel leaves more room for actual forms on small devices.
  const form = $("#authForm"),
    story = form.querySelector(".auth-brand-story");
  const brand = node("div", "auth-brand-signature");
  const mark = node("img");
  mark.src = "assets/launchpad.svg";
  mark.alt = "";
  mark.width = 36;
  mark.height = 36;
  brand.append(mark, node("strong", null, "Launchpad"));
  story.prepend(brand);
  const art = node("img", "auth-career-art");
  art.src = "assets/career-studio.svg";
  art.alt = "";
  art.width = 420;
  art.height = 310;
  story.append(art);
  const main = node("div", "auth-main");
  for (const child of [...form.children])
    if (child !== story) main.append(child);
  form.append(main);
  // Helpful zero states preserve the original controls and data model.
  const apply = $("#emptyState");
  const guide = node("div", "empty-steps");
  for (const [number, text] of [
    ["01", "Save an opportunity"],
    ["02", "Plan your next action"],
    ["03", "Follow your progress"],
  ]) {
    const item = node("span");
    item.append(node("b", null, number), document.createTextNode(text));
    guide.append(item);
  }
  apply.append(guide);
  for (const view of [
    "companies",
    "jobs",
    "roadmap",
    "coach",
    "analytics",
    "settings",
  ])
    document.querySelector("#" + view + "View")?.classList.add("studio-screen");
  // Settings sections receive meaningful landmarks without changing their forms.
  for (const [index, section] of [
    ...document.querySelectorAll("#settingsView section,#settingsView form"),
  ].entries()) {
    const h = section.querySelector("h2");
    if (h) {
      if (!h.id) h.id = "settings-section-" + index;
      section.setAttribute("aria-labelledby", h.id);
    }
  }
}
export function renderExperience(data, stats) {
  initialize();
  const compass = $("#careerCompass");
  compass.replaceChildren(node("p", "compass-eyebrow", "YOUR NORTH STAR"));
  const goal = data.goals[0];
  compass.append(
    node("h2", null, goal?.targetRole || "Make room for your next ambition."),
    node(
      "p",
      null,
      goal
        ? (goal.countries || []).join(" · ") ||
            "Choose a target region in your roadmap."
        : "Define the role, skills and places that matter to you.",
    ),
    link(
      goal ? "Open your career plan" : "Set your first career goal",
      "roadmap",
      "button compass-button",
    ),
  );
  const skillRow = node("div", "skill-chips");
  for (const skill of (goal?.skills || []).slice(0, 3))
    skillRow.append(node("span", null, skill));
  compass.append(skillRow);
  const momentum = $("#dashboardMomentum");
  momentum.replaceChildren(
    node("p", "eyebrow", "MOMENTUM"),
    node("h2", null, "Your application rhythm"),
  );
  const monthly = stats.monthly.slice(-6);
  if (monthly.length) {
    momentum.append(
      chart(
        monthly,
        monthly
          .map(([month, count]) => `${month}: ${count} applications`)
          .join("; "),
      ),
      node(
        "p",
        "helper",
        `${monthly.length} reported month${monthly.length === 1 ? "" : "s"} · ${monthly.reduce((sum, p) => sum + p[1], 0)} tracked records with dates`,
      ),
    );
  } else
    momentum.append(
      node("div", "empty-chart", "Your progress will take shape here."),
      node(
        "p",
        "helper",
        "Add an application date to see your own monthly activity. No example trend is displayed.",
      ),
    );
  const schedule = $("#dashboardSchedule");
  schedule.replaceChildren(
    node("p", "eyebrow", "ON YOUR HORIZON"),
    node("h2", null, "Interviews & deadlines"),
  );
  const next = reminders(data)
    .filter((r) => ["Interview", "Deadline", "Follow-up"].includes(r.kind))
    .slice(0, 3);
  if (!next.length)
    schedule.append(
      node(
        "p",
        "empty-copy",
        "No interviews or deadlines due in the next seven days. Add dates to an opportunity to plan ahead.",
      ),
    );
  for (const item of next) {
    const row = node("div", "schedule-row");
    row.dataset.overdue = String(item.overdue);
    row.append(
      node("span", "schedule-kind", item.kind),
      node("strong", null, item.title),
      node("time", null, item.date),
    );
    schedule.append(row);
  }
  schedule.append(link("Review applications", "applications"));
  // Dated events are actual tracked events, not an invented audit or activity log.
  const feed = $("#dashboardActivity .widget-content");
  const dated = data.applications
    .filter((a) => a.applicationDate)
    .sort((a, b) => b.applicationDate.localeCompare(a.applicationDate))
    .slice(0, 3);
  if (dated.length) {
    feed.replaceChildren();
    for (const app of dated) {
      const row = node("article", "activity-row");
      const content = node("div");
      content.append(
        node("strong", null, app.company),
        node("p", "helper", app.role),
        node("time", null, `Application date · ${app.applicationDate}`),
      );
      row.append(
        companyIdentity(app.company),
        content,
        node("span", `status-pill status-${app.status}`, app.status),
      );
      feed.append(row);
    }
    feed.append(link("All applications", "applications"));
  }
  const charts = $("#analyticsCharts");
  let visual = $("#analyticsOverview");
  if (!visual) {
    visual = node("section", "panel section-pad analytics-overview");
    visual.id = "analyticsOverview";
    $("#analyticsMetrics").after(visual);
  }
  visual.replaceChildren(node("div", "analytics-overview-copy"));
  const copy = visual.firstChild;
  copy.append(
    node("p", "eyebrow", "YOUR ACTUAL PIPELINE"),
    node("h2", null, "See the shape of your search."),
    node(
      "p",
      "helper",
      stats.total
        ? `${stats.total} tracked opportunities · ${stats.responseRate}% response rate using the definition above.`
        : "Add your first opportunity to unlock a meaningful view of your own application pipeline.",
    ),
  );
  if (!stats.total) {
    const first = node(
      "button",
      "button button-primary",
      "Track your first opportunity",
    );
    first.type = "button";
    first.addEventListener("click", () => {
      window.launchpadData.navigate("applications");
      window.launchpadData.openForm();
    });
    copy.append(first);
  }
  const bars = node("div", "status-distribution");
  bars.setAttribute("role", "img");
  bars.setAttribute(
    "aria-label",
    stats.statuses.map(([s, n]) => `${s}: ${n}`).join("; ") ||
      "No tracked applications",
  );
  for (const [status, count] of stats.statuses) {
    const segment = node("span");
    segment.dataset.status = status;
    segment.style.flexGrow = String(count);
    segment.title = `${status}: ${count}`;
    bars.append(segment);
  }
  visual.append(bars);
  charts.classList.add("analytics-chart-grid");
}
