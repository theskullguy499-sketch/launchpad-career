import { readStudio } from "./lib/career-studio.mjs";
import {
  careerNextStep,
  careerActivity,
  upcomingCommitments,
} from "./lib/career-intelligence.mjs";
import { bookmarkedJobs } from "./lib/job-discovery.mjs";
const $ = (s) => document.querySelector(s),
  el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
let context,
  scope = null,
  mounted = false,
  dialog,
  searchInput,
  resultList,
  resultCount,
  lastFocus = null,
  viewKey = "";
const routes = [
  ["Dashboard", "dashboard"],
  ["Applications", "applications"],
  ["Saved Jobs", "saved"],
  ["Companies", "companies"],
  ["Career Roadmap", "roadmap"],
  ["Resume Studio", "resume"],
  ["Interview Lab", "interview"],
  ["AI Career Coach", "coach"],
  ["Analytics", "analytics"],
  ["Settings", "settings"],
  ["Plans & Billing", "billing"],
];
function go(view) {
  if (view === "saved") {
    context.navigate("jobs");
    document
      .querySelector('.jobs-collection-tab[data-collection="saved"]')
      ?.click();
  } else context.navigate(view);
}
function link(text, view) {
  const a = el("a", "text-link", text);
  a.href = "#" + (view === "saved" ? "jobs" : view);
  if (view === "saved")
    a.addEventListener("click", (e) => {
      e.preventDefault();
      go("saved");
    });
  return a;
}
function currentStudio() {
  try {
    return readStudio(context.data.preferences);
  } catch {
    return { resumes: [], practices: [] };
  }
}
function commandItems() {
  const items = routes.map(([title, view]) => ({
    title,
    kind: "Navigate",
    run: () => go(view),
  }));
  items.push(
    {
      title: "Add application",
      kind: "Quick action",
      run: () => {
        go("applications");
        context.openForm();
      },
    },
    {
      title: "Create career goal",
      kind: "Quick action",
      run: () => {
        go("roadmap");
        context.addGoal();
      },
    },
  );
  for (const a of context.data.applications)
    items.push({
      title: a.role + " · " + a.company,
      kind: "Application",
      run: () => {
        go("applications");
        context.openApplication(a);
      },
    });
  for (const c of context.data.companies)
    items.push({
      title: c.name,
      kind: "Favorite company",
      run: () => {
        go("companies");
        window.launchpadWorkspace54?.company(c);
      },
    });
  for (const g of context.data.goals)
    items.push({
      title: g.title,
      kind: "Career goal",
      run: () => go("roadmap"),
    });
  for (const r of currentStudio().resumes)
    items.push({
      title: r.label,
      kind: "Resume version",
      run: () => {
        go("resume");
        const select = $("#resumeVersion");
        if ([...select.options].some((o) => o.value === r.id)) {
          select.value = r.id;
          select.dispatchEvent(new Event("change"));
        }
      },
    });
  return items;
}
function renderCommands() {
  if (!context) return;
  resultList.replaceChildren();
  if (context.busy) {
    resultCount.textContent =
      "Loading your workspace. Private results are unavailable until loading completes.";
    const loading = el("li", "search-skeleton");
    loading.setAttribute("aria-hidden", "true");
    resultList.append(loading);
    return;
  }
  const query = searchInput.value.trim().toLowerCase(),
    rows = commandItems()
      .filter(
        (x) =>
          !query ||
          x.title.toLowerCase().includes(query) ||
          x.kind.toLowerCase().includes(query),
      )
      .slice(0, 20),
    ticket = scope;
  resultCount.textContent = rows.length
    ? `${rows.length} results · ${context.mode === "account" ? "current account" : "this browser’s guest"} workspace only`
    : "No matches. Try a page, company, application or resume version name.";
  for (const item of rows) {
    const li = el("li"),
      b = el("button", "command-result");
    b.type = "button";
    b.append(el("span", null, item.title), el("small", null, item.kind));
    b.addEventListener("click", () => {
      if (ticket !== scope || context.busy) return;
      dialog.close();
      item.run();
    });
    li.append(b);
    resultList.append(li);
  }
}
function openSearch() {
  if (!context || document.querySelector("dialog[open]")) return;
  if (document.body.classList.contains("navigation-open"))
    $("#closeNavigation").click();
  lastFocus = document.activeElement;
  searchInput.value = "";
  renderCommands();
  dialog.showModal();
  $("#openGlobalSearch").setAttribute("aria-expanded", "true");
  searchInput.focus();
}
function mount() {
  if (mounted) return;
  mounted = true;
  const trigger = el("button", "button button-outline global-search-trigger");
  trigger.id = "openGlobalSearch";
  trigger.type = "button";
  trigger.append(el("span", null, "Search"), el("kbd", null, "Ctrl / ⌘ K"));
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", "globalSearchDialog");
  trigger.addEventListener("click", openSearch);
  $(".top-actions").prepend(trigger);
  dialog = el("dialog", "global-search-dialog");
  dialog.id = "globalSearchDialog";
  dialog.setAttribute("aria-labelledby", "globalSearchTitle");
  const head = el("div", "dialog-head");
  const title = el("h2", null, "Search your workspace");
  title.id = "globalSearchTitle";
  const close = el("button", "icon-btn", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Close global search");
  close.addEventListener("click", () => dialog.close());
  head.append(title, close);
  const label = el(
    "label",
    "global-search-label",
    "Search pages, records and quick actions",
  );
  searchInput = el("input");
  searchInput.id = "globalSearchInput";
  searchInput.type = "search";
  searchInput.autocomplete = "off";
  searchInput.maxLength = 100;
  searchInput.placeholder = "Try Resume Studio or a company name…";
  searchInput.addEventListener("input", renderCommands);
  label.append(searchInput);
  resultCount = el("p", "helper");
  resultCount.id = "globalSearchCount";
  resultCount.setAttribute("role", "status");
  resultList = el("ul", "command-results");
  resultList.id = "globalSearchResults";
  dialog.append(head, label, resultCount, resultList);
  document.body.append(dialog);
  dialog.addEventListener("close", () => {
    // A native close event may arrive after a rapid reopen. Do not clear
    // the newer query or move focus away from the reopened dialog.
    if (dialog.open) return;
    searchInput.value = "";
    resultList.replaceChildren();
    resultCount.textContent = "";
    trigger.setAttribute("aria-expanded", "false");
    if (lastFocus?.isConnected && !lastFocus.inert)
      lastFocus.focus({ preventScroll: true });
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = [...resultList.querySelectorAll("button")];
    if (!buttons.length) return;
    const i = buttons.indexOf(document.activeElement);
    if (
      (event.key === "Home" || event.key === "End") &&
      document.activeElement === searchInput
    )
      return;
    event.preventDefault();
    let next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowDown"
            ? (i + 1) % buttons.length
            : i <= 0
              ? buttons.length - 1
              : i - 1;
    buttons[next].focus();
  });
  document.addEventListener("keydown", (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      event.key.toLowerCase() === "k"
    ) {
      if (
        document.querySelector("dialog[open]") !== dialog &&
        document.querySelector("dialog[open]")
      )
        return;
      event.preventDefault();
      if (dialog.open) dialog.close();
      else openSearch();
    }
  });
  const section = el("section", "intelligence-dashboard");
  section.id = "intelligenceDashboard";
  section.setAttribute("aria-label", "Your career next steps");
  $("#dashboardView .studio-canvas").prepend(section);
}
function card(title, value, copy, view, variant) {
  const article = el("article", "intelligence-card " + variant);
  article.append(
    el("p", "eyebrow", title),
    el("strong", "intelligence-value", value),
    el("p", "helper", copy),
    link(
      "Open " +
        ({
          resume: "Resume Studio",
          interview: "Interview Lab",
          saved: "Saved Jobs",
          applications: "Applications",
        }[view] || "workspace"),
      view,
    ),
  );
  return article;
}
export function clearIntelligence55() {
  context = null;
  scope = null;
  viewKey = "";
  if (dialog?.open) dialog.close();
  if (mounted) {
    searchInput.value = "";
    resultList.replaceChildren();
    resultCount.textContent = "";
    $("#intelligenceDashboard").replaceChildren();
  }
}
export function renderIntelligence55(next) {
  context = next;
  mount();
  scope = next.scope;
  if (dialog.open) renderCommands();
  const data = next.data,
    studio = currentStudio();
  const key = JSON.stringify([
    scope,
    next.busy,
    data.profile.display_name,
    data.goals,
    data.milestones,
    data.applications,
    studio.resumes,
    studio.practices,
    data.preferences.savedJobs,
  ]);
  if (key === viewKey) return;
  viewKey = key;
  const root = $("#intelligenceDashboard");
  root.replaceChildren();
  root.setAttribute("aria-busy", String(next.busy));
  if (next.busy) {
    const text = el("p", "helper", "Loading your private career workspace…");
    text.setAttribute("role", "status");
    root.append(text, el("div", "career-loading-skeleton"));
    return;
  }
  const move = careerNextStep(data);
  const lead = el("article", "intelligence-next-step");
  lead.append(
    el("p", "eyebrow", "YOUR NEXT MOVE · RULE-BASED"),
    el("h2", null, move.title),
    el("p", null, move.detail),
    el("p", "helper", move.source),
    link("Take the next step →", move.view),
  );
  if (data.goals[0])
    lead.append(
      el("p", "intelligence-goal", "Your goal · " + data.goals[0].title),
    );
  root.append(lead);
  const grid = el("div", "intelligence-tool-grid");
  grid.append(
    card(
      "YOUR RESUMES",
      String(studio.resumes.length),
      studio.resumes[0]?.label ||
        "Build your first version from your real experience and projects.",
      "resume",
      "intelligence-blue",
    ),
    card(
      "INTERVIEW PRACTICE",
      String(studio.practices.length),
      studio.practices.length
        ? "Saved static practice exercises. Review or repeat an answer."
        : "Start with an English introduction or a project presentation.",
      "interview",
      "intelligence-violet",
    ),
    card(
      "SAVED OPPORTUNITIES",
      String(bookmarkedJobs(data.preferences).length),
      "Bookmarks from this workspace. Availability must be checked at the original source.",
      "saved",
      "intelligence-mint",
    ),
  );
  const events = upcomingCommitments(data.applications);
  for (const [kind, title, variant] of [
    ["Interview", "NEXT INTERVIEW", "intelligence-violet"],
    ["Deadline", "NEXT DEADLINE", "intelligence-amber"],
  ]) {
    const event = events.find((x) => x.kind === kind);
    grid.append(
      card(
        title,
        event?.date || "Not scheduled",
        event
          ? event.company + " · " + event.role
          : "Add an actual date to a tracked application to plan ahead.",
        "applications",
        variant,
      ),
    );
  }
  root.append(grid);
  const activity = careerActivity(data),
    feed = el("section", "intelligence-recent");
  feed.append(el("h2", null, "Recent saved activity"));
  if (!activity.length)
    feed.append(
      el(
        "p",
        "helper",
        "Save a resume, practice exercise or application update to start your activity timeline. Earlier activity is not reconstructed.",
      ),
    );
  const list = el("ol");
  for (const item of activity) {
    const row = el("li");
    row.append(
      el("time", null, new Date(item.at).toLocaleString("en-US")),
      link(item.title, item.view),
    );
    list.append(row);
  }
  feed.append(list);
  root.append(feed);
}
