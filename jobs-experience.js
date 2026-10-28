import {jobFitPanel} from "./job-fit55.js";
// Jobs presentation uses only the current workspace and retrieved source records.
import { companyIdentity, icon } from "./premium.js";
import { jobKey, reportedArrangement } from "./lib/job-discovery.mjs";
import { companies } from "./data/companies.mjs";
const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = String(text);
  return n;
};
let context,
  mounted = false,
  tab = "all",
  detailTab = "overview",
  lastDetail = "";
const fields = [
  "jobTitle",
  "jobCountry",
  "jobCompany",
  "jobStack",
  "jobExperience",
  "jobRemote",
  "jobSalary",
  "jobCategory",
  "jobEmploymentType",
  "jobQuery",
];
export function selectedJobKey() {
  const [route, query = ""] = location.hash.slice(1).split("?");
  return route === "jobs" ? new URLSearchParams(query).get("job") : null;
}
export function jobTab() {
  return $("#jobSavedOnly")?.checked
    ? "saved"
    : tab === "tracked"
      ? "tracked"
      : "all";
}
export function clearJobExperience() {
  tab = "all";
  detailTab = "overview";
  lastDetail = "";
  context = null;
  $("#jobDetails")?.replaceChildren();
  for (const id of ["jobQuery", "jobEmploymentType"])
    if ($("#" + id)) $("#" + id).value = "";
}
export function openJobDetails(job) {
  location.hash = "jobs?job=" + encodeURIComponent(jobKey(job));
}
function mount() {
  if (mounted) return;
  mounted = true;
  $("#jobsView .screen-heading h1").textContent = "Find your next opportunity.";
  const search = el("div", "jobs-discovery-search");
  const label = el("label", "jobs-query-label");
  label.append(
    el("span", "sr-only", "Search retrieved jobs, companies or skills"),
  );
  const input = el("input");
  input.id = "jobQuery";
  input.type = "search";
  input.maxLength = 200;
  input.autocomplete = "off";
  input.placeholder = "Search jobs, companies or skills…";
  input.setAttribute("form", "jobSearchForm");
  label.append(input);
  const searchButton = el("button", "button button-primary", "Search jobs");
  searchButton.type = "submit";
  searchButton.id = "jobQuickSearch";
  searchButton.setAttribute("form", "jobSearchForm");
  const filters = el(
    "button",
    "button button-outline jobs-filter-toggle",
    "Filters",
  );
  filters.type = "button";
  filters.id = "toggleJobFilters";
  filters.setAttribute("aria-controls", "jobSearchForm");
  const media = matchMedia("(max-width: 768px)");
  const setFilters = (expanded) => {
    $("#jobSearchForm").hidden = !expanded;
    filters.setAttribute("aria-expanded", String(expanded));
  };
  filters.addEventListener("click", () =>
    setFilters($("#jobSearchForm").hidden),
  );
  media.addEventListener("change", () => setFilters(!media.matches));
  setFilters(!media.matches);
  search.append(label, searchButton, filters);
  const tabs = el("div", "jobs-browse-tabs");
  tabs.setAttribute("role", "group");
  tabs.setAttribute("aria-label", "Job collection");
  for (const [value, name] of [
    ["all", "All jobs"],
    ["saved", "Saved jobs"],
    ["tracked", "Tracked jobs"],
  ]) {
    const button = el("button", "jobs-collection-tab", name);
    button.type = "button";
    button.dataset.collection = value;
    button.addEventListener("click", () => {
      tab = value;
      $("#jobSavedOnly").checked = value === "saved";
      context?.rerender();
    });
    tabs.append(button);
  }
  const chips = el("div", "jobs-filter-chips");
  chips.id = "jobFilterChips";
  const filterHeader = el("div", "jobs-filter-heading");
  const clear = el("button", "text-link", "Clear filters");
  clear.type = "button";
  clear.id = "clearJobFilters";
  clear.addEventListener("click", () => {
    for (const id of fields) {
      const field = $("#" + id);
      if (field.type === "checkbox") field.checked = false;
      else field.value = "";
    }
    context?.rerender();
    $("#jobQuery").focus({ preventScroll: true });
  });
  filterHeader.append(el("h2", null, "Filters"), clear);
  $("#jobSearchForm").prepend(filterHeader);
  const labelType = el("label", null, "Job type (source reported)");
  const type = el("select");
  type.id = "jobEmploymentType";
  type.append(new Option("All reported types", ""));
  labelType.append(type);
  $("#jobSearchForm .explorer-filters").append(labelType);
  const service = el("p", "jobs-source-status helper");
  service.id = "jobsServiceStatus";
  service.setAttribute("role", "status");
  const originalStatus = $("#jobStatus");
  originalStatus.removeAttribute("role");
  const syncStatus = () => {
    service.textContent = originalStatus.textContent;
  };
  new MutationObserver(syncStatus).observe(originalStatus, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  syncStatus();
  const canvas = $(".discovery-canvas");
  canvas.prepend(search, tabs, service, chips);
  for (const id of ["jobQuery", "jobEmploymentType"])
    $("#" + id).addEventListener(id === "jobQuery" ? "input" : "change", () =>
      context?.rerender(),
    );
  const details = el("section", "job-details-screen");
  details.id = "jobDetails";
  details.hidden = true;
  details.setAttribute("aria-label", "Job details");
  details.tabIndex = -1;
  $("#jobsView").append(details);
  window.addEventListener("hashchange", () => {
    if (context) renderDetails();
  });
}
function sourceDescription(text) {
  const root = el("div", "job-provider-description");
  const blocks = text.split(/\n{2,}/);
  // Keep pathological provider text bounded in DOM nodes without losing content.
  if (blocks.length > 150) {
    root.append(el("p", null, text));
    return root;
  }
  for (const block of blocks) {
    if (
      /^(about (?:the |this )?role|job (?:description|overview)|responsibilities|key responsibilities|what you(?: will|'ll) do|requirements|qualifications|benefits|nice to have|about (?:us|the company))[:.]?$/i.test(
        block.trim(),
      )
    ) {
      root.append(el("h3", null, block));
    } else if (
      block.split("\n").length <= 80 &&
      block.split("\n").every((line) => /^• /.test(line))
    ) {
      const list = el("ul");
      for (const line of block.split("\n"))
        list.append(el("li", null, line.slice(2)));
      root.append(list);
    } else root.append(el("p", null, block));
  }
  return root;
}
function sourceLink(label, href, cls = "text-link") {
  const arrow = label.endsWith(" ↗");
  const a = el("a", cls, arrow ? label.slice(0, -2) : label);
  if (arrow) a.append(icon("arrow"));
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}
function detailsAction(label, id, operation, pressed) {
  const b = el("button", "button button-outline", label);
  b.id = id;
  b.type = "button";
  if (pressed !== undefined) b.setAttribute("aria-pressed", String(pressed));
  b.addEventListener("click", async () => {
    const owner = context?.scope;
    b.disabled = true;
    try {
      await operation();
    } catch (error) {
      if (context && context.scope === owner && $("#jobDetailsStatus"))
        $("#jobDetailsStatus").textContent = error.message;
    } finally {
      if (context?.scope === owner) {
        const next = $("#" + id);
        if (next) {
          next.disabled = false;
          next.focus({ preventScroll: true });
        }
      }
    }
  });
  return b;
}
function renderDetails() {
  const key = selectedJobKey(),
    root = $("#jobDetails");
  const active = key !== null;
  root.hidden = !active;
  $(".discovery-workbench").hidden = active;
  $("#jobsView > .screen-heading").hidden = active;
  $("#jobsView").dataset.detail = String(active);
  if (!active) {
    const returning = Boolean(lastDetail);
    lastDetail = "";
    root.replaceChildren();
    if (returning && !$("#jobsView").hidden) {
      $("#jobQuery").focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    return;
  }
  const changed = lastDetail !== key;
  if (changed) detailTab = "overview";
  lastDetail = key;
  root.replaceChildren();
  const back = el("a", "job-back-link", "← Back to results");
  back.href = "#jobs";
  root.append(back);
  // Lookup is restricted to the active snapshot; URL text never fetches arbitrary URLs.
  const job =
    key.length <= 300
      ? [...context.jobs, ...context.saved].find((j) => jobKey(j) === key)
      : null;
  if (!job) {
    root.append(
      el("h1", null, "This listing is not loaded."),
      el(
        "p",
        "helper",
        "Retrieve the source listings or return to your saved jobs. An unsaved listing is not cached between page reloads or accounts.",
      ),
    );
    const retry = el(
      "button",
      "button button-primary",
      "Retrieve current listings",
    );
    retry.type = "button";
    retry.disabled = $("#jobSearchForm button[type=submit]").disabled;
    retry.addEventListener("click", () => $("#jobSearchForm").requestSubmit());
    root.append(retry, el("p", "helper", $("#jobStatus").textContent));
    if (changed) root.focus({ preventScroll: true });
    return;
  }
  const saved = context.saved.some((j) => jobKey(j) === key),
    tracked = context.data.applications.some(
      (a) =>
        a.sourceId === `job:remotive:${job.id}` ||
        a.id === `job:remotive:${job.id}`,
    );
  const header = el("header", "panel job-detail-hero");
  const employer = el("div", "job-detail-company");
  employer.append(
    companyIdentity(job.company),
    el("p", "eyebrow", job.company),
  );
  const title = el("h1", null, job.title);
  title.id = "jobDetailsTitle";
  const meta = el("div", "job-detail-meta");
  for (const value of [
    job.location || "Location not supplied",
    reportedArrangement(job),
    job.employmentType?.replaceAll("_", " ") || "Job type not supplied",
    job.salary || "Salary not supplied",
  ])
    meta.append(el("span", null, value));
  const actions = el("div", "button-row job-detail-actions");
  actions.append(
    sourceLink("Apply at source ↗", job.url, "button button-primary"),
    detailsAction(
      saved ? "Remove bookmark" : "Bookmark opportunity",
      "detailBookmark",
      () => context.toggleBookmark(job),
      saved,
    ),
    detailsAction(
      tracked ? "Already in tracker" : "Save to tracker",
      "detailSaveTracker",
      () => context.saveToTracker(job),
    ),
  );
  actions.lastChild.disabled = tracked;
  const tags = el("div", "job-tags");
  for (const tag of job.tags) tags.append(el("span", null, tag));
  header.append(employer, title, meta, actions, tags);
  root.append(header);
  const status = el("p", "platform-status");
  status.id = "jobDetailsStatus";
  status.setAttribute("role", "status");
  root.append(status);
  const layout = el("div", "job-detail-layout"),
    main = el("section", "panel section-pad job-description-panel"),
    rail = el("aside", "job-detail-rail");
  rail.setAttribute("aria-label", "Listing provenance and employer");
  const tabs = el("div", "job-detail-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Listing information");
  const all = [
    ["overview", "Overview"],
    ["facts", "Listing facts"],
    ["checklist", "Before you apply"],
  ];
  for (const [id, name] of all) {
    const button = el("button", null, name);
    button.id = "jobTab-" + id;
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(detailTab === id));
    button.tabIndex = detailTab === id ? 0 : -1;
    button.setAttribute("aria-controls", "jobPanel-" + id);
    const select = () => {
      detailTab = id;
      renderDetails();
      $("#jobTab-" + id).focus();
    };
    button.addEventListener("click", select);
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const i = all.findIndex(([key]) => key === id);
      detailTab =
        all[
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? 2
              : (i + (event.key === "ArrowRight" ? 1 : 2)) % 3
        ][0];
      renderDetails();
      $("#jobTab-" + detailTab).focus();
    });
    tabs.append(button);
  }
  main.append(tabs);
  for (const [id, name] of all) {
    const panel = el("div", "job-detail-tab-panel");
    panel.id = "jobPanel-" + id;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", "jobTab-" + id);
    panel.tabIndex = 0;
    panel.hidden = detailTab !== id;
    panel.append(
      el("h2", null, name === "Overview" ? "About this opportunity" : name),
    );
    if (id === "overview") {
      panel.append(
        sourceDescription(
          job.descriptionText ||
            "The provider did not supply a description in this response. Open the original listing for responsibilities, requirements and benefits. No missing details are invented.",
        ),
      );
      if (job.descriptionTruncated)
        panel.append(
          el(
            "p",
            "helper",
            "This is a limited excerpt. Open the original listing for the complete source description.",
          ),
        );
    } else if (id === "facts") {
      const facts = el("dl", "job-facts");
      for (const [key, value] of [
        ["Company", job.company],
        ["Location", job.location],
        ["Arrangement", reportedArrangement(job)],
        ["Employment type", job.employmentType?.replaceAll("_", " ")],
        ["Category", job.category],
        ["Salary (provider text)", job.salary],
        ["Publication date", job.postedAt],
        ["Source", job.source],
      ])
        facts.append(
          el("dt", null, key),
          el("dd", null, value || "Not supplied"),
        );
      panel.append(facts);
    } else {
      panel.append(
        el(
          "p",
          "helper",
          "General application guidance, not an AI match score or a hiring guarantee.",
        ),
      );
      const list = el("ul", "job-apply-checklist");
      for (const text of [
        "Read the original listing and confirm that it is still open.",
        "Check country, work authorization, time zone and language requirements.",
        "Verify the employer and salary terms before sharing personal information.",
        "Tailor your resume to the actual role; never pay a fee to apply.",
        "Saving to Launchpad does not submit an application or change its status to Applied.",
      ])
        list.append(el("li", null, text));
      panel.append(list);
    }
    main.append(panel);
  }
  const provenance = el("section", "panel section-pad job-source-panel");
  provenance.append(
    el("p", "eyebrow", "SOURCE INFORMATION"),
    el("h2", null, job.source),
    el(
      "p",
      "helper",
      `Published: ${job.postedAt || "Not supplied"}. Source listings may be delayed, edited or closed.`,
    ),
    sourceLink("Open original listing ↗", job.url),
    el(
      "p",
      "helper",
      "Application continues on the provider’s listing. Launchpad does not collect applications, verify hiring status or invent employer application URLs.",
    ),
  );
  if (job.descriptionTruncated) {
    const refresh = el(
      "button",
      "button button-outline",
      "Retrieve updated source details",
    );
    refresh.type = "button";
    refresh.disabled = $("#jobSearchForm button[type=submit]").disabled;
    refresh.addEventListener("click", () =>
      $("#jobSearchForm").requestSubmit(),
    );
    provenance.append(
      refresh,
      el(
        "p",
        "helper",
        "The current source pool may no longer include this saved listing. Its original URL remains available above.",
      ),
    );
  }
  if (
    context.jobs.length ||
    $("#jobStatus").textContent.includes("unavailable")
  )
    provenance.append(el("p", "helper", $("#jobStatus").textContent));
  if (saved)
    provenance.append(
      el(
        "p",
        "helper",
        "Bookmarked in this workspace. Saved listings may be outdated; verify details at the source.",
      ),
    );
  rail.append(provenance);
  const known = companies.find(
    (c) => c.name.toLowerCase() === job.company.toLowerCase(),
  );
  if (known?.website) {
    const company = el("section", "panel section-pad job-company-panel");
    company.append(
      companyIdentity(job.company),
      el("h2", null, job.company),
      el(
        "p",
        "helper",
        "Curated company-directory website. No affiliation or currently open role is implied.",
      ),
      sourceLink("Company website ↗", known.website),
    );
    rail.append(company);
  }
  layout.append(main, rail);
  root.append(layout, jobFitPanel(job,context.data));
  if (changed) root.focus({ preventScroll: true });
}
export function renderJobExperience(next) {
  context = next;
  mount();
  for (const button of document.querySelectorAll(".jobs-collection-tab"))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.collection === jobTab()),
    );
  const select = $("#jobEmploymentType"),
    value = select.value;
  select.replaceChildren(
    new Option("All reported types", ""),
    ...[
      ...new Set(
        [...context.jobs, ...context.saved]
          .map((j) => j.employmentType)
          .filter(Boolean),
      ),
    ]
      .sort()
      .map((v) => new Option(v.replaceAll("_", " "), v)),
  );
  select.value = [...select.options].some((o) => o.value === value)
    ? value
    : "";
  const chips = $("#jobFilterChips");
  chips.replaceChildren();
  for (const id of fields) {
    const field = $("#" + id);
    if (!field || (field.type === "checkbox" ? !field.checked : !field.value))
      continue;
    const label = field.type === "checkbox" ? "Salary provided" : field.value;
    const button = el("button", "job-filter-chip", label + " ×");
    button.type = "button";
    button.setAttribute("aria-label", "Remove filter: " + label);
    button.addEventListener("click", () => {
      if (field.type === "checkbox") field.checked = false;
      else field.value = "";
      context.rerender();
      $("#jobQuery").focus({ preventScroll: true });
    });
    chips.append(button);
  }
  $("#clearJobFilters").disabled = !chips.children.length;
  renderDetails();
}
