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
  hero.querySelector(".ascent-art").src = "assets/career-objects.svg";
  const intro = dashboard.querySelector(".intro-copy");
  intro.textContent =
    "Your personal career studio. Every number and next step starts with your own progress.";
  // A compact story panel leaves more room for actual forms on small devices.
  const form = $("#authForm"),
    story = form.querySelector(".auth-brand-story");
  const brand = node("div", "auth-brand-signature");
  const mark = node("img");
  mark.src = "assets/brand/launchpad-lockup-dark.svg";
  mark.alt = "Launchpad — Your Career, Higher.";
  mark.width = 255;
  mark.height = 72;
  brand.append(mark);
  story.prepend(brand);
  const art = node("img", "auth-career-art");
  art.src = "assets/career-objects.svg";
  art.alt = "";
  art.width = 420;
  art.height = 310;
  story.append(art);
  const main = node("div", "auth-main");
  for (const child of [...form.children])
    if (child !== story) main.append(child);
  form.append(main);
  // Reference-inspired workbench: compact main column and a truthful personal rail.
  const workbench = node("div", "studio-workbench");
  const canvas = node("div", "studio-canvas");
  const rail = node("div", "studio-rail");
  rail.setAttribute("aria-label", "Career calendar and progress");
  rail.setAttribute("role", "region");
  heading.after(workbench);
  workbench.append(canvas, rail);
  canvas.append($("#dashboardMetrics"));
  const storyGrid = node("div", "studio-story-grid");
  canvas.append(storyGrid);
  storyGrid.append(hero, momentum, activity, $("#dashboardCoach"), compass, $("#dashboardFocus"));
  const calendar = node("section", "panel section-pad career-calendar");
  calendar.id = "careerCalendar";
  rail.append(calendar, $("#dashboardJourney"), schedule);
  canvas.append(strip, onboarding);
  bento.remove();
  lead.remove();
  const jobs = $("#jobsView");
  const explorer = node("div", "discovery-workbench");
  const results = node("div", "discovery-canvas");
  jobs.querySelector(".screen-heading").after(explorer);
  explorer.append($("#jobSearchForm"), results);
  results.append($(".job-results-toolbar"), $("#jobResults"), $("#loadMoreJobs"));
  const sidebarCard = $(".sidebar .goal-card");
  sidebarCard.append(link("Compare plans", "billing", "sidebar-plan-link"));
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
let calendarMonth = null;
function renderCareerCalendar(data) {
  const today = new Date();
  calendarMonth ||= new Date(today.getFullYear(), today.getMonth(), 1);
  const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
  const monthLabel = calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const root = $("#careerCalendar");
  root.replaceChildren();
  const header = node("div", "calendar-heading");
  const title = node("h2", null, monthLabel);
  title.id = "calendarMonthLabel";
  title.setAttribute("aria-live", "polite");
  const controls = node("div", "calendar-controls");
  for (const [offset, text, label] of [[-1, "‹", "Previous month"], [1, "›", "Next month"]]) {
    const button = node("button", "icon-btn", text);
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => {
      calendarMonth = new Date(year, month + offset, 1);
      renderCareerCalendar(data);
      // Rebuilding the read-only calendar must not strand keyboard focus.
      root.querySelector(`[aria-label="${label}"]`).focus();
    });
    controls.append(button);
  }
  header.append(title, controls);
  const table = node("table", "month-grid");
  table.setAttribute("aria-labelledby", title.id);
  const head = node("thead"), headerRow = node("tr");
  for (const [short, full] of [["M","Monday"],["T","Tuesday"],["W","Wednesday"],["T","Thursday"],["F","Friday"],["S","Saturday"],["S","Sunday"]]) {
    const th = node("th", null, short);
    th.scope = "col";
    th.setAttribute("aria-label", full);
    headerRow.append(th);
  }
  head.append(headerRow);
  const events = [];
  const add = (value, text, view) => {
    if (!value) return;
    const parsed = new Date(value.length === 10 ? value + "T12:00:00" : value);
    if (!Number.isFinite(parsed.getTime())) return;
    events.push({ day: [parsed.getFullYear(), String(parsed.getMonth()+1).padStart(2,"0"), String(parsed.getDate()).padStart(2,"0")].join("-"), text, view });
  };
  for (const app of data.applications) {
    if (["Rejected", "Withdrawn", "Hired"].includes(app.status)) continue;
    add(app.deadline, `Deadline · ${app.company}`, "applications");
    add(app.interviewAt, `Interview · ${app.company}`, "applications");
    add(app.followUp, `Follow-up · ${app.company}`, "applications");
  }
  for (const task of data.tasks) if (!task.completed) add(task.dueDate, `Task · ${task.title}`, "dashboard");
  for (const milestone of data.milestones) if (!milestone.completed) add(milestone.targetDate, `Milestone · ${milestone.title}`, "roadmap");
  const body = node("tbody");
  const start = (new Date(year, month, 1).getDay() + 6) % 7;
  const last = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < Math.ceil((start + last)/7)*7; i += 7) {
    const row = node("tr");
    for (let j = 0; j < 7; j++) {
      const day = i + j - start + 1, cell = node("td");
      if (day > 0 && day <= last) {
        const date = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        const matches = events.filter(e => e.day === date);
        const time = node("time", matches.length ? "has-career-event" : null, day);
        time.dateTime = date;
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) time.setAttribute("aria-current", "date");
        time.setAttribute("aria-label", `${date}${matches.length ? `, ${matches.length} planned items` : ""}`);
        cell.append(time);
      }
      row.append(cell);
    }
    body.append(row);
  }
  table.append(head, body);
  root.append(header, table, node("p", "helper calendar-legend", "Dots mark your dated items. Today is highlighted."));
  const monthEvents = events.filter(e => e.day.startsWith(`${year}-${String(month+1).padStart(2,"0")}`)).sort((a,b)=>a.day.localeCompare(b.day));
  if (monthEvents.length) {
    const list = node("ul", "calendar-events");
    for (const event of monthEvents.slice(0, 3)) {
      const item = node("li");
      item.append(node("time", null, event.day.slice(8)), link(event.text, event.view));
      list.append(item);
    }
    root.append(list);
    if (monthEvents.length > 3) root.append(node("p", "helper", `${monthEvents.length} planned items this month. Review your tasks and applications for the complete list.`));
  } else root.append(node("p", "empty-copy", "No dated items this month. Add a deadline, interview or task date to plan ahead."));
}
export function renderExperience(data, stats) {
  initialize();
  renderCareerCalendar(data);
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
