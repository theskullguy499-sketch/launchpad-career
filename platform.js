import { readStudio } from "./lib/career-studio.mjs";
import { renderIntelligence55, clearIntelligence55 } from "./intelligence55.js";
import { renderInterview55, clearInterview55 } from "./interview55.js";
import { renderCareer55, clearCareer55 } from "./career55.js";
import {
  renderWorkspace54,
  clearWorkspace54,
  viewApplicationHistory,
} from "./workspace54.js";
import {
  recordApplicationUpdate,
  nextApplicationAction,
  datedMonths,
  periodApplications,
  safeCompanyLink,
} from "./lib/workspace-insights.mjs";
window.launchpadHistory = Object.freeze({ record: recordApplicationUpdate });
import {
  renderJobExperience,
  clearJobExperience,
  openJobDetails,
  jobTab,
} from "./jobs-experience.js";
import { renderExperience } from "./evolution.js";
import {
  filterJobs,
  bookmarkRecord,
  assertBookmarkBudget,
  bookmarkedJobs,
  reportedArrangement,
  jobKey,
  JOB_PAGE_SIZE,
  BOOKMARK_LIMIT,
} from "./lib/job-discovery.mjs";
import {
  renderPremiumDashboard,
  companyIdentity,
  decorateApplicationRows,
} from "./premium.js";
import { getAuthClient } from "./auth-client.js";
import { createWorkspace } from "./lib/workspace.mjs";
import {
  statuses,
  uid,
  safeUrl,
  analytics,
  reminders,
  starterRoadmap,
  backupPayload,
  validateApplication,
  validateJobResults,
} from "./lib/model.mjs";
import { companies as catalog } from "./data/companies.mjs";
import { countries } from "./data/countries.mjs";
const $ = (s) => document.querySelector(s);
const node = (tag, cls, value) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (value !== undefined) e.textContent = String(value);
  return e;
};
const action = (label, handler, primary = false) => {
  const b = node(
    "button",
    primary ? "button button-primary" : "button button-outline",
    label,
  );
  b.type = "button";
  b.addEventListener("click", () =>
    Promise.resolve().then(handler).catch(report),
  );
  return b;
};
const report = (error) => {
  $("#platformStatus").textContent = error?.message || String(error);
};
const navigate = (view) => window.launchpadData.navigate(view);
const download = (name, value) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = node("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
};
const empty = (container, message) =>
  container.append(node("p", "empty-copy", message));
let snapshot,
  boardMode = false,
  currentJobs = [],
  jobPage = 1,
  jobRequestVersion = 0,
  currentPlan = null;
let coachRequest = 0;
// Expand the original country/currency controls without changing their persisted values.
$("#country").replaceChildren(
  new Option("Select a country", ""),
  ...countries.map((c) => new Option(c.name, c.name)),
  new Option("Other", "Other"),
);
if (Intl.supportedValuesOf) {
  const names = new Intl.DisplayNames(["en"], { type: "currency" });
  $("#currency").replaceChildren(
    ...Intl.supportedValuesOf("currency").map(
      (code) =>
        new Option(
          code + " — " + names.of(code),
          code,
          code === "USD",
          code === "USD",
        ),
    ),
  );
  $("#currency").value = "USD";
}
const screens = {
  home: `<div class="landing-hero"><div class="landing-brand"><img class="brand-on-light" src="assets/brand/launchpad-lockup-light.svg" width="300" height="85" alt="Launchpad — Your Career, Higher." /><img class="brand-on-dark" src="assets/brand/launchpad-lockup-dark.svg" width="300" height="85" alt="Launchpad — Your Career, Higher." /></div><span class="release-badge">LAUNCHPAD 5.5 · CAREER INTELLIGENCE RC</span><h1>Your Career,<br><em>Higher.</em></h1><p class="intro-copy">Turn international career ambitions into a clear next step. Track opportunities, research employers and build a learning plan you can actually follow.</p><div id="landingActions" class="button-row"></div><div class="value-grid"><article><span>01 / ORGANIZE</span><h2>Every opportunity, in focus.</h2><p>A detailed application tracker, a Kanban pipeline, and follow-ups that stay connected.</p></article><article><span>02 / BUILD</span><h2>A roadmap with momentum.</h2><p>Set your objective, make weekly milestones and see progress from your own activity.</p></article><article><span>03 / OWN</span><h2>Your data. Your choice.</h2><p>Start locally as a guest. Choose when to import records into a verified account workspace.</p></article></div></div><div class="panel section-pad"><h2>Built for a considered next chapter</h2><p>Explore a curated company directory and, when configured, sourced remote jobs and a private-by-default AI coach. No invented vacancies, success claims or subscription charges.</p><div id="landingLinks" class="button-row"></div></div>`,
  dashboard: `<div class="screen-heading"><div><p class="eyebrow">YOUR NEXT CHAPTER</p><h1>Small steps.<br><em>Higher ambitions.</em></h1><p class="intro-copy">A clear view of what matters next, based on your own activity.</p></div><div id="dashboardActions" class="button-row"></div></div><div id="onboardingCard" class="panel section-pad"></div><div id="dashboardMetrics" class="metrics-grid"></div><div class="split-grid"><section class="panel section-pad"><div class="section-head"><h2>Upcoming & overdue</h2><button id="refreshReminders" class="button button-outline" type="button">Refresh</button></div><p class="helper">In-app reminders update while Launchpad is open. Background/email delivery requires a configured scheduler.</p><div id="reminderList"></div></section><section class="panel section-pad"><div class="section-head"><h2>Your tasks</h2><button id="addTaskBtn" class="button button-primary" type="button">Add task</button></div><div id="taskList"></div></section></div><section class="panel section-pad"><h2>Favorite employers</h2><div id="dashboardCompanies" class="directory-grid"></div></section>`,
  companies: `<div class="screen-heading"><div><p class="eyebrow">RESEARCH WITH INTENT</p><h1>Find your<br><em>next employer.</em></h1><p class="intro-copy">A curated directory, not a worldwide catalog or a claim that these companies are hiring. Website links are curated; availability has not been live-verified. Headquarters and career-page links are omitted until verified.</p></div><button id="addCompanyBtn" class="button button-primary" type="button">Add a company</button></div><div class="panel section-pad"><div class="explorer-filters"><label>Search companies<input id="companySearch" type="search" placeholder="Company or industry" /></label><label>Industry<select id="companyIndustry"><option value="all">All industries</option></select></label><label>Country (verified or user supplied)<input id="companyCountry" type="search" placeholder="Country, if known" /></label><label class="check-label"><input type="checkbox" id="favoritesOnly" /> Favorites only</label></div><p id="companyCount" class="helper" role="status"></p><div id="companyList" class="directory-grid"></div></div>`,
  jobs: `<div class="screen-heading"><div><p class="eyebrow">SOURCED OPPORTUNITIES</p><h1>A real opening.<br><em>A considered move.</em></h1><p class="intro-copy">Search retrieved vacancies from Remotive through the configured backend. This source covers remote roles, is delayed by 24 hours, and is not a complete jobs database. Listings remain accessible to guests; no signup is required to view them.</p></div></div><form id="jobSearchForm" class="panel section-pad"><div class="explorer-filters"><label>Job title<input id="jobTitle" type="search" maxlength="100" placeholder="e.g. Frontend developer" /></label><label>Country or region<input id="jobCountry" maxlength="100" placeholder="e.g. Brazil or Worldwide" /></label><label>Company<input id="jobCompany" maxlength="100" /></label><label>Technology keyword<input id="jobStack" maxlength="100" placeholder="e.g. JavaScript" /></label><label>Experience (title text match)<select id="jobExperience"><option value="">All levels</option><option>Junior</option><option>Senior</option><option>Lead</option><option>Intern</option></select></label><label>Arrangement<select id="jobRemote"><option>Remote</option></select></label><label class="check-label"><input type="checkbox" id="jobSalary" /> Salary provided</label></div><button class="button button-primary" type="submit">Find opportunities</button><p id="jobStatus" class="helper" role="status">No job source has been contacted. Search to check the configured service. No sample vacancies are shown.</p><a href="https://remotive.com/" target="_blank" rel="noopener noreferrer">Job data source: Remotive</a></form><div id="jobResults" class="directory-grid"></div>`,
  coach: `<div class="screen-heading"><div><p class="eyebrow">THINK THROUGH YOUR NEXT STEP</p><h1>Your AI<br><em>career coach.</em></h1><p class="intro-copy">Generative assistance through a secure backend, when configured. No responses are simulated. Suggestions are not guarantees of employment or immigration eligibility.</p></div></div><div class="split-grid"><form id="coachForm" class="panel section-pad"><label>Your question<textarea id="coachPrompt" rows="6" maxlength="6000" required placeholder="Help me plan a weekly learning routine for a frontend role."></textarea></label><fieldset><legend>Optional context — shared only with your consent</legend><label class="check-label"><input type="checkbox" id="shareProfile" /> My saved profile</label><label class="check-label"><input type="checkbox" id="shareGoals" /> My career goals</label><label class="check-label"><input type="checkbox" id="shareProgress" /> My roadmap progress</label><label class="check-label"><input type="checkbox" id="shareHistory" /> My last saved exchanges</label><label class="check-label"><input type="checkbox" id="saveExchange" /> Save this exchange to my private account history</label></fieldset><label>Response type<select id="coachIntent"><option value="advice">Career guidance</option><option value="roadmap">Structured roadmap</option></select></label><button type="submit" class="button button-primary">Ask coach</button><p id="coachStatus" class="helper" role="status">The AI service requires a verified account, age-appropriate onboarding, a deployed function and a server-side API key. It is unavailable until those prerequisites are configured.</p></form><section class="panel section-pad"><h2>Coach response</h2><div id="coachResponse" class="coach-copy"></div><div id="planActions" class="button-row"></div><h3>Saved history</h3><p class="helper">Saving is optional. You can delete history in Settings.</p><div id="coachHistory"></div></section></div>`,
  analytics: `<div class="screen-heading"><div><p class="eyebrow">PROGRESS, WITHOUT THE GUESSWORK</p><h1>Your journey.<br><em>In perspective.</em></h1><p class="intro-copy">Every measure below comes from the current workspace. Response rate is interviews, offers, hires and rejections divided by submitted applications; it is not a prediction.</p></div></div><div id="analyticsMetrics" class="metrics-grid"></div><div id="analyticsCharts" class="split-grid"></div>`,
  settings: `<div class="screen-heading"><div><p class="eyebrow">YOUR WORKSPACE, YOUR RULES</p><h1>Make room<br><em>for your goals.</em></h1></div></div><div class="split-grid"><form id="profileForm" class="panel section-pad"><h2>Profile & onboarding</h2><label>Display name<input id="profileName" maxlength="100" /></label><label>Target job title<input id="profileTitle" maxlength="100" /></label><label>Country (optional)<input id="profileCountry" maxlength="60" /></label><label>Age range<select id="profileAge"><option value="">Prefer guest mode / not stated</option><option value="16-17">16–17</option><option value="18+">18 or older</option></select></label><p class="helper">Accounts and AI are for people aged 16 or older. We do not request an exact birth date. People under 16 can use the local guest organizer without sending a profile to external services.</p><label class="check-label"><input type="checkbox" id="historyPreference" /> Remember my preference to save AI exchanges</label><label class="check-label"><input type="checkbox" id="emailPreference" /> Request email reminders when a scheduler and email service are deployed</label><p class="helper">Email reminders do not run from a closed browser. Saving this preference alone does not activate delivery.</p><button class="button button-primary" type="submit">Save profile & preferences</button></form><section class="panel section-pad"><h2>Privacy & account controls</h2><p>Guest records are shared by this browser profile. Verified account workspaces are loaded separately and require the configured Supabase tables and RLS. Private account data is not cached as guest data.</p><div id="privacyActions" class="button-stack"></div><h3>Account deletion</h3><p class="helper">Deletion requires password reauthentication and the deployed account-deletion function. It deletes your account and associated cloud records. It does not delete guest records.</p><label>Current password<input id="deletePassword" type="password" autocomplete="current-password" /></label><button id="deleteAccountBtn" class="button danger-button" type="button">Delete my account</button><p id="settingsStatus" role="status" class="helper"></p></section></div><form id="feedbackForm" class="panel section-pad"><h2>Send feedback</h2><label>What would improve your experience?<textarea id="feedbackText" maxlength="3000" rows="3" required></textarea></label><p class="helper">Avoid sensitive personal information. Account feedback is saved for the project owner to review; no response time is promised. Guests can download feedback instead.</p><div class="button-row"><button class="button button-primary" type="submit">Submit feedback</button><button class="button button-outline" id="downloadFeedback" type="button">Download feedback</button></div></form><section class="panel section-pad"><h2>Privacy Policy & Terms</h2><p>These are accurate product drafts for qualified legal review, not a declaration of legal compliance. Do not open a commercial service until operator identity, contact details, regional obligations and retention arrangements have been finalized.</p><div id="legalLinks" class="button-row"></div></section>`,
};
const iconPaths = {
  home: "M5 19 19 5M5 5h14v14",
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  applications: "M8 4H5v17h14V4h-3M8 3h8v4H8zM8 11h8M8 15h5",
  roadmap: "M5 20V5h14M5 15h8V9h6M16 6l3 3-3 3",
  companies: "M5 21V3h14v18M3 21h18M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-5h4v5",
  jobs: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  resume: "M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6",
  interview: "M4 4h16v12H9l-5 4zM8 8h8M8 12h5",
  coach: "M4 4h16v12H9l-5 4zM12 6l1 3 3 1-3 1-1 3-1-3-3-1 3-1z",
  analytics: "M4 20V11h4v9M10 20V5h4v15M16 20V8h4v12M2 21h20",
  settings: "M3 6h18M3 12h18M3 18h18M8 3v6M16 9v6M10 15v6",
};
for (const button of document.querySelectorAll(".nav-item")) {
  const span = button.querySelector("span");
  span.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[button.dataset.view] || iconPaths.home}"/></svg>`;
}
$(".goal-orbit").innerHTML =
  '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
for (const [view, markup] of Object.entries(screens)) {
  const section = node("section", "view");
  section.id = view + "View";
  section.setAttribute(
    "aria-label",
    view === "coach" ? "AI Career Coach" : view + " screen",
  );
  section.hidden = true;
  section.innerHTML = markup;
  $("#platformScreens").append(section);
}
const jobCategoryLabel = node(
  "label",
  null,
  "Professional area (source category)",
);
const jobCategory = node("select");
jobCategory.id = "jobCategory";
jobCategory.append(new Option("All reported areas", ""));
jobCategoryLabel.append(jobCategory);
$("#jobSearchForm .explorer-filters").append(jobCategoryLabel);
$("#jobRemote").replaceChildren(
  new Option("Any reported arrangement", ""),
  new Option("Remote", "Remote"),
);
const jobToolbar = node("div", "job-results-toolbar");
const savedLabel = node("label", "check-label");
const savedCheck = node("input");
savedCheck.type = "checkbox";
savedCheck.id = "jobSavedOnly";
savedLabel.append(savedCheck, node("span", null, "Bookmarked opportunities"));
const sortLabel = node("label", null, "Sort listings");
const jobSort = node("select");
jobSort.id = "jobSort";
jobSort.append(
  new Option("Source order", ""),
  new Option("Newest reported first", "newest"),
  new Option("Company A–Z", "company"),
);
sortLabel.append(jobSort);
const jobCount = node("p", "helper");
jobCount.id = "jobResultCount";
jobCount.setAttribute("role", "status");
const importJobBookmarks = action("Import guest bookmarks", async () => {
  if (store.mode !== "account")
    throw new Error("Open your account workspace first.");
  const guest = bookmarkedJobs(store.guestSnapshot().preferences);
  if (!guest.length) throw new Error("No valid guest bookmarks are available.");
  if (
    !confirm(
      `Copy guest job bookmarks into ${store.owner.email}? Existing account and guest records will be preserved.`,
    )
  )
    return;
  await store.update((next) => {
    const current = bookmarkedJobs(next.preferences),
      keys = new Set(current.map(jobKey));
    const additions = guest.filter((job) => !keys.has(jobKey(job)));
    if (additions.length && current.length + additions.length > BOOKMARK_LIMIT)
      throw new Error(
        "Import would exceed the new-bookmark limit. Existing and guest bookmarks are unchanged; export JSON before organizing them.",
      );
    const raw = Array.isArray(next.preferences.savedJobs)
      ? next.preferences.savedJobs
      : [];
    next.preferences.savedJobs = [...raw, ...additions];
  });
});
importJobBookmarks.id = "importJobBookmarks";
importJobBookmarks.hidden = true;
jobToolbar.append(savedLabel, sortLabel, jobCount, importJobBookmarks);
$("#jobResults").before(jobToolbar);
const moreJobs = action("Load more opportunities", () => {
  jobPage++;
  renderJobs();
});
moreJobs.id = "loadMoreJobs";
moreJobs.hidden = true;
$("#jobResults").after(moreJobs);
for (const id of [
  "jobTitle",
  "jobCountry",
  "jobCompany",
  "jobStack",
  "jobExperience",
  "jobSalary",
  "jobRemote",
  "jobCategory",
  "jobSort",
  "jobSavedOnly",
]) {
  $("#" + id).addEventListener("input", () => {
    jobPage = 1;
    renderJobs();
  });
}
const planPanel = node("section", "panel section-pad personal-plan");
planPanel.innerHTML = `<div class="section-head"><div><h2>Your personalized plan</h2><p>Editable goals and milestones, saved in the active workspace.</p></div><div id="roadmapActions" class="button-row"></div></div><div id="careerGoals"></div><div id="personalProgress"></div><div id="personalMilestones"></div>`;
$("#roadmapView").insertBefore(planPanel, $("#roadmapView .roadmap-progress"));
const editDialog = node("dialog", "application-dialog");
editDialog.id = "platformEditor";
editDialog.setAttribute("aria-label", "Edit workspace item");
document.body.append(editDialog);
function editor(title, fields, value, save) {
  editDialog.replaceChildren();
  const form = node("form");
  const head = node("div", "dialog-head");
  head.append(
    node("h2", null, title),
    action("Close", () => editDialog.close()),
  );
  form.append(head);
  const grid = node("div", "form-grid");
  for (const spec of fields) {
    const label = node("label", spec.wide ? "full-width" : "", spec.label);
    const input = node(
      spec.options ? "select" : spec.type === "textarea" ? "textarea" : "input",
    );
    input.name = spec.key;
    input.id = "editor-" + spec.key;
    if (spec.options)
      for (const option of spec.options) {
        const item = node(
          "option",
          null,
          typeof option === "string" ? option : option.label,
        );
        item.value = typeof option === "string" ? option : option.value;
        input.append(item);
      }
    else if (spec.type !== "textarea") input.type = spec.type || "text";
    else input.rows = 3;
    input.value =
      value[spec.key] ??
      (spec.options
        ? typeof spec.options[0] === "string"
          ? spec.options[0]
          : spec.options[0].value
        : "");
    input.required = !!spec.required;
    if (spec.max) input.maxLength = spec.max;
    if (spec.type === "number") {
      input.min = spec.min ?? 0;
      input.max = spec.limit ?? 1000000000;
    }
    label.append(input);
    grid.append(label);
  }
  const status = node("p", "error-msg");
  status.setAttribute("role", "alert");
  const submit = node("button", "button button-primary", "Save");
  submit.type = "submit";
  const row = node("div", "dialog-actions");
  row.append(
    action("Cancel", () => editDialog.close()),
    submit,
  );
  form.append(grid, status, row);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    try {
      await save(Object.fromEntries(new FormData(form)));
      editDialog.close();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
  editDialog.append(form);
  editDialog.showModal();
  form.querySelector("input,select,textarea")?.focus();
}
let activeScope = null;
function clearPrivateView() {
  clearIntelligence55();
  clearCareer55();
  clearInterview55();
  clearWorkspace54();
  clearJobExperience();
  coachRequest++;
  jobRequestVersion++;
  currentJobs = [];
  jobPage = 1;
  $("#jobSavedOnly").checked = false;
  $("#jobStatus").textContent =
    "No job source has been contacted in this workspace. Choose Find opportunities to check the configured source.";
  const jobSubmit = $("#jobSearchForm button[type=submit]");
  jobSubmit.disabled = false;
  jobSubmit.textContent = "Find opportunities";
  if ($("#jobQuickSearch")) $("#jobQuickSearch").disabled = false;
  $("#jobSearchForm").removeAttribute("aria-busy");
  const coachForm = $("#coachForm");
  coachForm.removeAttribute("aria-busy");
  const coachSubmit = coachForm.querySelector('button[type="submit"]');
  coachSubmit.disabled = false;
  coachSubmit.textContent = "Ask coach";
  window.launchpadData.resetFilters?.();
  for (const id of [
    "companySearch",
    "companyCountry",
    "jobTitle",
    "jobCountry",
    "jobCompany",
    "jobStack",
    "jobExperience",
    "jobCategory",
    "jobSort",
    "jobRemote",
  ])
    $("#" + id).value = "";
  $("#companyIndustry").value = "all";
  $("#favoritesOnly").checked = false;
  $("#jobSalary").checked = false;
  for (const id of [
    "shareProfile",
    "shareGoals",
    "shareProgress",
    "shareHistory",
    "saveExchange",
  ])
    $("#" + id).checked = false;
  for (const id of ["applicationDialog", "platformEditor"]) {
    const dialog = $("#" + id);
    if (dialog.open) dialog.close();
  }
  $("#applicationForm").reset();
  editDialog.replaceChildren();
  $("#coachPrompt").value = "";
  $("#coachResponse").textContent = "";
  $("#planActions").replaceChildren();
  $("#feedbackText").value = "";
  $("#deletePassword").value = "";
  currentPlan = null;
  $("#coachStatus").textContent =
    "AI requires a verified account and the configured secure backend. No guest data is sent.";
}
const store = createWorkspace({
  getClient: getAuthClient,
  onStatus: (status) => {
    $("#syncStatus").textContent = status;
  },
  readGuest: () => window.launchpadData.readGuest(),
  persistGuest: (value) => window.launchpadData.commitGuest(value),
  onChange: (state) => {
    const scope = state.mode + ":" + (state.owner?.id || "guest");
    if (activeScope !== scope) {
      clearPrivateView();
      activeScope = scope;
    }
    snapshot = state.data;
    $(".local-data-notice").textContent =
      state.mode === "account"
        ? "Account workspace: changes require your verified cloud session. Guest records remain on this device and are not displayed here."
        : "Guest dashboard: local records are shared by accounts in this browser profile. Signing in does not make them private per account. Use a separate browser profile on shared devices.";
    $("#workspaceModeText").textContent =
      state.mode === "account"
        ? " ACCOUNT DATA · CLOUD"
        : " GUEST DATA · THIS BROWSER";
    document.body.dataset.workspace = state.mode;
    $(".workspace-bar").dataset.workspace = state.mode;
    $("#workspaceLabel").textContent =
      state.mode === "account"
        ? `Account workspace · ${state.owner.email}`
        : "Guest workspace · stored on this device";
    $("#syncStatus").textContent = state.status;
    $("#workspaceContent").inert = state.busy;
    $("#useGuestBtn").hidden = state.mode === "guest";
    $("#reloadCloudBtn").hidden = state.mode === "guest";
    $("#openCloudBtn").hidden =
      state.mode === "account" || !window.launchpadSession;
    window.launchpadData.replace(state.data);
    renderAll();
    window.dispatchEvent(
      new CustomEvent("launchpad:setup-progress", {
        detail: {
          mode: state.mode,
          ownerId: state.owner?.id || null,
          busy: state.busy,
          profile: Boolean(state.data.profile?.display_name?.trim()),
          goals: state.data.goals.length > 0,
        },
      }),
    );
  },
});
const reload = action("Reload cloud data", () => store.refresh());
reload.id = "reloadCloudBtn";
reload.hidden = true;
const openCloud = action("Open account workspace", () =>
  store.enter(window.launchpadSession),
);
openCloud.id = "openCloudBtn";
openCloud.hidden = true;
$(".workspace-bar").append(reload, openCloud);
$("#useGuestBtn").addEventListener("click", () => store.enter(null));
window.launchpadWorkspace = {
  isAccount: () => store.mode === "account",
  saveTracker: (entries) => store.saveTracker(entries),
  backup: () => backupPayload(store.snapshot),
  exportAll: () => store.exportAll(),
  importGuest: async () => {
    if (store.mode !== "account" || store.busy)
      throw new Error("Load your verified account workspace first.");
    const email = store.owner.email;
    if (
      !confirm(
        `Copy guest opportunities, favorites, goals, tasks and milestones to ${email}? Existing account records and guest records will be kept.`,
      )
    )
      return false;
    await store.importGuest();
    return true;
  },
  restoreBackup: async (applications, completed, extras) => {
    for (const key of ["companies", "goals", "milestones", "tasks"])
      if (
        extras[key] !== undefined &&
        (!Array.isArray(extras[key]) ||
          extras[key].length > 1000 ||
          extras[key].some(
            (x) =>
              !x ||
              typeof x.id !== "string" ||
              typeof x[key === "companies" ? "name" : "title"] !== "string",
          ))
      )
        throw new Error("Invalid extended backup.");
    for (const key of ["profile", "preferences"])
      if (
        extras[key] !== undefined &&
        (!extras[key] ||
          typeof extras[key] !== "object" ||
          Array.isArray(extras[key]))
      )
        throw new Error("Invalid backup settings.");
    if (extras.preferences) readStudio(extras.preferences);
    await store.update((next) => {
      next.applications = applications;
      next.completed = completed;
      for (const key of [
        "companies",
        "goals",
        "milestones",
        "tasks",
        "profile",
        "preferences",
      ])
        if (extras[key] !== undefined) next[key] = extras[key];
    });
  },
};
window.addEventListener("launchpad:auth", (event) => {
  for (const id of ["applicationDialog", "platformEditor"]) {
    const dialog = $("#" + id);
    if (dialog.open) dialog.close();
  }
  $("#applicationForm").reset();
  editDialog.replaceChildren();
  $("#coachPrompt").value = "";
  $("#coachResponse").textContent = "";
  $("#planActions").replaceChildren();
  $("#deletePassword").value = "";
  currentPlan = null;
  store.enter(event.detail).catch(report);
});
window.addEventListener("launchpad:changed", (event) =>
  store.trackerChanged(event.detail),
);
window.addEventListener("launchpad:render", (event) => {
  renderBoard(event.detail);
  decorateApplicationRows();
});
window.addEventListener("launchpad:navigate", () => {
  if (snapshot) renderAll();
});
function metricCards(container, items) {
  container.replaceChildren();
  for (const [label, value] of items) {
    const card = node("article", "metric-card");
    card.append(node("span", "stat-label", label), node("strong", null, value));
    container.append(card);
  }
}
function removeItem(collection, id, label) {
  if (!confirm(`Delete ${label}?`)) return;
  return store.update((next) => {
    next[collection] = next[collection].filter((item) => item.id !== id);
  });
}
function taskEditor(value = {}) {
  editor(
    value.id ? "Edit task" : "Add task",
    [
      { key: "title", label: "Task title", required: true, max: 200 },
      { key: "dueDate", label: "Due date", type: "date" },
      { key: "notes", label: "Notes", type: "textarea", max: 1000, wide: true },
    ],
    value,
    (fields) =>
      store.update((next) => {
        const item = {
          ...value,
          ...fields,
          id: value.id || uid(),
          completed: value.completed || false,
        };
        next.tasks = value.id
          ? next.tasks.map((t) => (t.id === value.id ? item : t))
          : [...next.tasks, item];
      }),
  );
}
function goalEditor(value = {}) {
  editor(
    value.id ? "Edit career goal" : "Add career goal",
    [
      { key: "title", label: "Main objective", required: true, max: 160 },
      {
        key: "targetRole",
        label: "Target job title",
        required: true,
        max: 100,
      },
      {
        key: "countriesText",
        label: "Target countries (comma separated)",
        max: 300,
      },
      {
        key: "arrangement",
        label: "Work arrangement",
        options: ["Remote", "Hybrid", "On-site", "Flexible"],
      },
      {
        key: "skillsText",
        label: "Skills to learn (comma separated)",
        max: 500,
      },
      { key: "targetDate", label: "Target date", type: "date" },
      {
        key: "applicationTarget",
        label: "Application target",
        type: "number",
        limit: 1000,
      },
    ],
    {
      ...value,
      countriesText: value.countries?.join(", ") || "",
      skillsText: value.skills?.join(", ") || "",
    },
    (fields) =>
      store.update((next) => {
        const item = {
          ...value,
          ...fields,
          id: value.id || uid(),
          countries: fields.countriesText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          skills: fields.skillsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        };
        next.goals = value.id
          ? next.goals.map((g) => (g.id === value.id ? item : g))
          : [...next.goals, item];
      }),
  );
}
function milestoneEditor(value = {}) {
  editor(
    value.id ? "Edit milestone" : "Add milestone",
    [
      { key: "title", label: "Milestone", required: true, max: 200 },
      {
        key: "kind",
        label: "Type",
        options: [
          "Weekly",
          "Monthly",
          "Skill",
          "Course",
          "Certification",
          "Project",
          "Application",
        ],
      },
      { key: "targetDate", label: "Target date", type: "date" },
      {
        key: "notes",
        label: "Details and resource link",
        type: "textarea",
        max: 2000,
        wide: true,
      },
    ],
    value,
    (fields) =>
      store.update((next) => {
        const item = {
          ...value,
          ...fields,
          id: value.id || uid(),
          completed: value.completed || false,
        };
        next.milestones = value.id
          ? next.milestones.map((m) => (m.id === value.id ? item : m))
          : [...next.milestones, item];
      }),
  );
}
function renderAll() {
  if (!snapshot) return;
  const stats = analytics(snapshot);
  const periodData = {
    ...snapshot,
    applications: periodApplications(
      snapshot.applications,
      document.querySelector("#analyticsPeriod")?.value || "all",
    ),
  };
  const periodStats = analytics(periodData);
  $(".goal-card strong").textContent =
    snapshot.goals[0]?.targetRole || "Your next chapter starts here.";
  $("#demoDataNotice").hidden = !snapshot.applications.some(
    (a) => a.demo || /^SAMPLE ONLY/.test(a.notes || ""),
  );
  metricCards($("#dashboardMetrics"), [
    ["Opportunities", stats.total],
    ["Applications submitted", stats.submitted],
    ["Interviews scheduled", stats.interviews],
    ["Offers & hires", stats.offers],
  ]);
  metricCards($("#analyticsMetrics"), [
    ["Tracked", periodStats.total],
    ["Submitted", periodStats.submitted],
    ["Interviews scheduled", periodStats.interviews],
    ["Offers & hires", periodStats.offers],
    ["Response rate", periodStats.responseRate + "%"],
    ["Deadlines in 14 days", periodStats.deadlines],
    ["Personal roadmap", periodStats.roadmap + "%"],
  ]);
  renderTasks();
  renderReminders();
  renderCompanies();
  renderRoadmap();
  renderAnalytics({
    ...periodStats,
    monthly: datedMonths(periodData.applications),
  });
  renderProfile();
  renderHistory();
  renderBoard(window.launchpadData.visible());
  renderOnboarding();
  renderPremiumDashboard(snapshot, stats);
  renderExperience(snapshot, stats);
  decorateApplicationRows();
  renderJobs();
  renderCareer55({
    data: snapshot,
    scope: store.mode + ":" + (store.owner?.id || "guest"),
    mode: store.mode,
    busy: store.busy,
    update: (change) => store.update(change),
    navigate,
    addGoal: () => goalEditor(),
    openForm: () => window.launchpadData.openForm(),
    guestPreferences: () => store.guestSnapshot().preferences,
  });
  renderInterview55({
    data: snapshot,
    scope: store.mode + ":" + (store.owner?.id || "guest"),
    mode: store.mode,
    busy: store.busy,
    update: (change) => store.update(change),
    navigate,
    addGoal: () => goalEditor(),
    openForm: () => window.launchpadData.openForm(),
    guestPreferences: () => store.guestSnapshot().preferences,
  });
  renderIntelligence55({
    data: snapshot,
    scope: store.mode + ":" + (store.owner?.id || "guest"),
    mode: store.mode,
    busy: store.busy,
    update: (change) => store.update(change),
    navigate,
    addGoal: () => goalEditor(),
    openForm: () => window.launchpadData.openForm(),
    openApplication: (a) => window.launchpadData.openForm(a),
    guestPreferences: () => store.guestSnapshot().preferences,
  });
  renderWorkspace54({
    data: snapshot,
    stats,
    periodData,
    periodStats,
    scope: store.mode + ":" + (store.owner?.id || "guest"),
    rerender: renderAll,
    editMilestone: milestoneEditor,
  });
}
function renderOnboarding() {
  const c = $("#onboardingCard");
  c.replaceChildren();
  c.hidden = !!snapshot.preferences.onboarded;
  if (!c.hidden)
    c.append(
      node("h2", null, "Start with one clear goal"),
      node(
        "p",
        null,
        "Choose your target role, set your privacy preferences and make a small plan. No exact birth date or sensitive background information is needed.",
      ),
      action("Set up my profile", () => navigate("settings")),
      action("Add my career goal", () => goalEditor()),
    );
}
function renderTasks() {
  const list = $("#taskList");
  list.replaceChildren();
  if (!snapshot.tasks.length)
    empty(list, "No tasks yet. Add one small action for your next step.");
  for (const task of snapshot.tasks) {
    const row = node("article", "list-item");
    const label = node("label", "check-label");
    const check = node("input");
    check.type = "checkbox";
    check.checked = task.completed;
    check.addEventListener("change", () =>
      store
        .update((next) => {
          next.tasks.find((t) => t.id === task.id).completed = check.checked;
        })
        .catch((error) => {
          check.checked = !check.checked;
          report(error);
        }),
    );
    label.append(check, node("strong", null, task.title));
    const controls = node("div", "button-row");
    controls.append(
      action("Edit", () => taskEditor(task)),
      action("Delete", () => removeItem("tasks", task.id, "this task")),
    );
    row.append(
      label,
      node("p", "helper", task.dueDate ? `Due ${task.dueDate}` : "No due date"),
      controls,
    );
    list.append(row);
  }
}
function renderReminders() {
  const list = $("#reminderList");
  list.replaceChildren();
  const dismissed = snapshot.preferences.dismissedReminders || [];
  const items = reminders(snapshot).filter(
    (item) => !dismissed.includes(item.id),
  );
  if (!items.length) empty(list, "Nothing due in the next seven days.");
  for (const item of items.slice(0, 30)) {
    const row = node("article", "reminder");
    row.append(
      node(
        "strong",
        null,
        `${item.overdue ? "Overdue · " : ""}${item.kind}: ${item.title}`,
      ),
      node("p", "helper", item.date),
      action("Dismiss", () =>
        store.update((next) => {
          next.preferences.dismissedReminders = [
            ...(next.preferences.dismissedReminders || []),
            item.id,
          ].slice(-500);
        }),
      ),
    );
    list.append(row);
  }
  for (const notice of snapshot.notifications || []) {
    if (notice.data?.read || notice.read) continue;
    const row = node("article", "reminder");
    row.append(
      node("p", "helper", notice.title || "Account reminder"),
      action("Mark read", () => store.markNotificationRead(notice)),
    );
    list.append(row);
  }
}
function directory() {
  const own = new Map(snapshot.companies.map((c) => [c.id, c]));
  return [
    ...catalog.map((c) => ({ ...c, ...own.get(c.id) })),
    ...snapshot.companies.filter(
      (c) => !catalog.some((item) => item.id === c.id),
    ),
  ];
}
function renderCompanies() {
  const all = directory();
  const industry = $("#companyIndustry");
  const selected = industry.value;
  industry.replaceChildren();
  const first = node("option", null, "All industries");
  first.value = "all";
  industry.append(first);
  for (const name of [
    ...new Set(all.map((c) => c.industry).filter(Boolean)),
  ].sort()) {
    const opt = node("option", null, name);
    opt.value = name;
    industry.append(opt);
  }
  industry.value = selected || "all";
  const query = $("#companySearch").value.trim().toLowerCase(),
    country = $("#companyCountry").value.trim().toLowerCase();
  const visible = all.filter(
    (c) =>
      (c.name + " " + c.industry).toLowerCase().includes(query) &&
      (industry.value === "all" || c.industry === industry.value) &&
      (!country || (c.country || "").toLowerCase().includes(country)) &&
      (!$("#favoritesOnly").checked || c.favorite),
  );
  const list = $("#companyList");
  list.replaceChildren();
  $("#companyCount").textContent =
    `${visible.length} companies · no hiring status is implied`;
  if (!visible.length)
    empty(list, "No matching companies. You can add an employer of your own.");
  for (const c of visible) list.append(companyCard(c));
  const favorites = $("#dashboardCompanies");
  favorites.replaceChildren();
  const saved = all.filter((c) => c.favorite);
  if (!saved.length) empty(favorites, "Favorite a company to keep it close.");
  for (const c of saved.slice(0, 4)) favorites.append(companyCard(c));
  const suggestions = $("#companySuggestions");
  suggestions.replaceChildren();
  for (const name of [...new Set(all.map((c) => c.name))]) {
    const option = node("option");
    option.value = name;
    suggestions.append(option);
  }
}
function companyCard(c) {
  const card = node("article", "directory-card");
  card.dataset.industry = c.industry || "Unspecified";
  card.dataset.favorite = String(!!c.favorite);
  const logo = companyIdentity(c.name, c);
  card.append(
    logo,
    node("h3", null, c.name),
    node(
      "p",
      "helper",
      `${c.industry || "Industry not stated"} · ${c.country || "Country not verified"}`,
    ),
  );
  const row = node("div", "button-row");
  const star = action(c.favorite ? "Unfavorite" : "Favorite", () =>
    store.update((next) => {
      const prior = next.companies.find((x) => x.id === c.id);
      if (prior) prior.favorite = !prior.favorite;
      else next.companies.push({ ...c, favorite: true });
    }),
  );
  star.setAttribute("aria-pressed", String(!!c.favorite));
  star.setAttribute(
    "aria-label",
    `${c.favorite ? "Unfavorite" : "Favorite"} ${c.name}`,
  );
  row.append(star);
  for (const [label, value] of [
    [
      c.source === "User supplied"
        ? "Website (user supplied)"
        : "Official website",
      c.website,
    ],
    [
      c.source === "User supplied"
        ? "Careers link (user supplied)"
        : "Careers page",
      c.careersUrl,
    ],
  ])
    if (safeCompanyLink(value)) {
      const link = node("a", "text-link", label);
      link.href = safeCompanyLink(value);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      row.append(link);
    }
  const count = snapshot.applications.filter(
    (a) => a.company.toLowerCase() === c.name.toLowerCase(),
  ).length;
  row.append(
    action(`${count} tracked applications`, () => {
      navigate("applications");
      $("#searchInput").value = c.name;
      $("#searchInput").dispatchEvent(new Event("input"));
    }),
  );
  row.append(
    action("Company details", () => window.launchpadWorkspace54?.company(c)),
  );
  card.append(row);
  return card;
}
function addCompany() {
  editor(
    "Add a company",
    [
      { key: "name", label: "Company name", required: true, max: 80 },
      { key: "industry", label: "Industry", max: 80 },
      { key: "country", label: "Country (user supplied)", max: 60 },
      {
        key: "website",
        label: "Official website URL (optional)",
        type: "url",
        max: 1000,
      },
      {
        key: "careersUrl",
        label: "Careers URL (user supplied, optional)",
        type: "url",
        max: 1000,
      },
    ],
    {},
    (fields) => {
      if (
        directory().some(
          (c) => c.name.toLowerCase() === fields.name.trim().toLowerCase(),
        )
      )
        throw new Error(
          "This company is already in the directory. Search for it and choose Favorite.",
        );
      if (fields.website && !safeCompanyLink(fields.website))
        throw new Error(
          "Use an https:// or http:// website URL without embedded credentials.",
        );
      if (fields.careersUrl && !safeCompanyLink(fields.careersUrl))
        throw new Error("Use a safe careers URL without embedded credentials.");
      return store.update((next) =>
        next.companies.push({
          ...fields,
          id: uid(),
          favorite: true,
          source: "User supplied",
        }),
      );
    },
  );
}
function renderRoadmap() {
  const goals = $("#careerGoals");
  goals.replaceChildren();
  if (!snapshot.goals.length)
    empty(goals, "Add a career goal to create a personalized starter roadmap.");
  for (const goal of snapshot.goals) {
    const row = node("article", "list-item");
    row.append(
      node("h3", null, goal.title),
      node(
        "p",
        "helper",
        `${goal.targetRole} · ${(goal.countries || []).join(", ") || "No target countries"} · ${goal.arrangement || "Flexible"}`,
      ),
      node("p", null, `Skills: ${(goal.skills || []).join(", ") || "Not set"}`),
      action("Edit goal", () => goalEditor(goal)),
      action("Delete goal", () => removeItem("goals", goal.id, "this goal")),
    );
    goals.append(row);
  }
  const complete = snapshot.milestones.filter((m) => m.completed).length;
  $("#personalProgress").textContent =
    `${complete} / ${snapshot.milestones.length} personal milestones complete`;
  const list = $("#personalMilestones");
  list.replaceChildren();
  for (const item of snapshot.milestones) {
    const row = node("article", "list-item journey-milestone");
    row.classList.toggle("is-complete", item.completed);
    const label = node("label", "check-label");
    const check = node("input");
    check.type = "checkbox";
    check.checked = item.completed;
    check.addEventListener("change", () =>
      store
        .update((next) => {
          next.milestones.find((m) => m.id === item.id).completed =
            check.checked;
        })
        .catch((error) => {
          check.checked = !check.checked;
          report(error);
        }),
    );
    label.append(check, node("strong", null, item.title));
    row.append(
      label,
      node(
        "p",
        "helper",
        `${item.kind} · ${item.targetDate || "No target date"}`,
      ),
      node("p", "helper", item.notes || ""),
      action("Edit milestone", () => milestoneEditor(item)),
      action("Delete milestone", () =>
        removeItem("milestones", item.id, "this milestone"),
      ),
    );
    list.append(row);
  }
}
function renderAnalytics(stats) {
  const charts = $("#analyticsCharts");
  charts.replaceChildren();
  for (const [title, rows] of [
    ["Applications by status", stats.statuses],
    ["Applications by country", stats.countries],
    ["Applications by company", stats.companies],
    ["Monthly activity", stats.monthly],
  ]) {
    const section = node("section", "panel section-pad");
    section.append(node("h2", null, title));
    if (!rows.length) empty(section, "No activity to chart yet.");
    const max = Math.max(1, ...rows.map(([, n]) => n));
    for (const [label, count] of rows.slice(0, 20)) {
      const row = node("div", "chart-row");
      row.append(node("span", null, label), node("strong", null, count));
      const track = node("div", "chart-track");
      const fill = node("div", "chart-fill");
      fill.style.width = `${(count / max) * 100}%`;
      track.append(fill);
      row.append(track);
      section.append(row);
    }
    charts.append(section);
  }
}
function renderBoard(apps) {
  if (!$("#kanbanBoard")) return;
  $("#kanbanBoard").hidden = !boardMode;
  if (boardMode) $("#tableWrap").hidden = true;
  const board = $("#kanbanBoard");
  board.replaceChildren();
  if (!boardMode) return;
  for (const status of statuses) {
    const column = node("section", "kanban-column");
    column.dataset.stage = status;
    column.append(
      node(
        "h3",
        null,
        `${status} · ${apps.filter((a) => a.status === status).length}`,
      ),
    );
    column.addEventListener("dragover", (event) => event.preventDefault());
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("text/plain");
      store
        .update((next) => {
          const app = next.applications.find((a) => a.id === id);
          if (app)
            Object.assign(
              app,
              recordApplicationUpdate(app, { ...app, status }),
            );
        })
        .catch(report);
    });
    for (const app of apps.filter((a) => a.status === status)) {
      const card = node("article", "kanban-card");
      card.draggable = true;
      card.addEventListener("dragstart", (event) =>
        event.dataTransfer.setData("text/plain", app.id),
      );
      card.append(
        companyIdentity(app.company),
        node("strong", null, app.company),
        node("p", null, app.role),
        node(
          "p",
          "helper",
          `${app.country} · ${app.priority || "Medium"} priority`,
        ),
      );
      const label = node("label", null, "Move to stage");
      const select = node("select");
      for (const stage of statuses) {
        const opt = node("option", null, stage);
        opt.value = stage;
        select.append(opt);
      }
      select.value = status;
      select.addEventListener("change", () =>
        store
          .update((next) => {
            const item = next.applications.find((a) => a.id === app.id);
            Object.assign(
              item,
              recordApplicationUpdate(item, { ...item, status: select.value }),
            );
          })
          .catch((error) => {
            select.value = status;
            report(error);
          }),
      );
      label.append(select);
      card.append(
        node("p", "kanban-next-action", nextApplicationAction(app)),
        node(
          "time",
          "helper",
          app.applicationDate
            ? `Applied: ${app.applicationDate}`
            : "Application date not set",
        ),
        label,
        action("History", () => viewApplicationHistory(app)),
        action("Edit", () => window.launchpadData.openForm(app)),
        action("Delete", () =>
          removeItem("applications", app.id, "this application"),
        ),
      );
      column.append(card);
    }
    board.append(column);
  }
}
function renderProfile() {
  const profile = snapshot.profile;
  $("#profileName").value = profile.display_name || "";
  $("#profileTitle").value = profile.title || "";
  $("#profileCountry").value = profile.country || "";
  $("#profileAge").value = profile.age_band || "";
  $("#historyPreference").checked = !!snapshot.preferences.saveCoachHistory;
  $("#emailPreference").checked = !!snapshot.preferences.emailReminders;
  $("#saveExchange").checked = !!snapshot.preferences.saveCoachHistory;
}
function renderHistory() {
  const list = $("#coachHistory");
  list.replaceChildren();
  if (!snapshot.aiHistory.length) empty(list, "No exchanges saved.");
  for (const item of snapshot.aiHistory) {
    const details = node("details", "history-item");
    details.append(
      node("summary", null, item.prompt || "Career planning"),
      node(
        "p",
        "coach-copy",
        typeof item.response === "string"
          ? item.response
          : JSON.stringify(item.response, null, 2),
      ),
    );
    list.append(details);
  }
}
async function invoke(name, body) {
  const expectedUser = store.owner?.id;
  let client;
  try {
    client = await getAuthClient();
  } catch (error) {
    if (error.message === "not-configured")
      throw new Error(
        "This service is not configured yet. You can continue using guest features.",
      );
    throw error;
  }
  if (["ai-coach", "delete-account"].includes(name))
    body = { ...body, expected_user: body.expected_user || expectedUser };
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    let message =
      "Service unavailable. Confirm the backend deployment and configuration.";
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  if (!data || data.error)
    throw new Error(data?.error || "The service returned no usable response.");
  return data;
}
$("#jobSearchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector("button[type=submit]");
  if (submit.disabled) return;
  const ticket = ++jobRequestVersion;
  jobPage = 1;
  submit.disabled = true;
  $("#jobQuickSearch").disabled = true;
  submit.textContent = "Finding opportunities…";
  $("#jobSearchForm").setAttribute("aria-busy", "true");
  $("#jobStatus").textContent = "Checking the configured job source…";
  try {
    const result = await invoke("job-explorer", {});
    if (ticket !== jobRequestVersion) return;
    currentJobs = validateJobResults(result.jobs);
    renderJobs();
    $("#jobStatus").textContent =
      `Source: ${result.source || "Remotive"} · fetched ${result.fetchedAt || "time not supplied"}${result.stale ? " · cached data; refresh unavailable" : ""}. Only retrieved listings are displayed.`;
  } catch (error) {
    if (ticket !== jobRequestVersion) return;
    currentJobs = [];
    renderJobs();
    $("#jobStatus").textContent = "Job Explorer unavailable: " + error.message;
  } finally {
    if (ticket === jobRequestVersion) {
      submit.disabled = false;
      submit.textContent = "Find opportunities";
      $("#jobQuickSearch").disabled = false;
      renderJobs();
      $("#jobSearchForm").removeAttribute("aria-busy");
    }
  }
});
function renderJobs() {
  const list = $("#jobResults");
  list.replaceChildren();
  if (!snapshot) return;
  const saved = bookmarkedJobs(snapshot.preferences);
  renderJobExperience({
    jobs: currentJobs,
    saved,
    data: snapshot,
    scope: store.mode + ":" + (store.owner?.id || "guest"),
    toggleBookmark: toggleJobBookmark,
    saveToTracker: saveJobToTracker,
    rerender: () => {
      jobPage = 1;
      renderJobs();
    },
  });
  $("#importJobBookmarks").hidden =
    store.mode !== "account" ||
    !bookmarkedJobs(store.guestSnapshot().preferences).length;
  const collection = jobTab();
  const pool = collection === "saved" ? saved : currentJobs;
  const source =
    collection === "tracked"
      ? pool.filter((j) =>
          snapshot.applications.some(
            (a) =>
              a.sourceId === `job:remotive:${j.id}` ||
              a.id === `job:remotive:${j.id}`,
          ),
        )
      : pool;
  const selected = $("#jobCategory").value;
  $("#jobCategory").replaceChildren(
    new Option("All reported areas", ""),
    ...[...new Set(source.map((j) => j.category).filter(Boolean))]
      .sort()
      .map((value) => new Option(value, value)),
  );
  $("#jobCategory").value = [...$("#jobCategory").options].some(
    (o) => o.value === selected,
  )
    ? selected
    : "";
  const jobs = filterJobs(source, {
    query: $("#jobQuery").value,
    employmentType: $("#jobEmploymentType").value,
    title: $("#jobTitle").value,
    country: $("#jobCountry").value,
    company: $("#jobCompany").value,
    stack: $("#jobStack").value,
    experience: $("#jobExperience").value,
    salary: $("#jobSalary").checked,
    category: $("#jobCategory").value,
    arrangement: $("#jobRemote").value,
    sort: $("#jobSort").value,
  });
  const shown = jobs.slice(0, jobPage * JOB_PAGE_SIZE);
  $("#jobResultCount").textContent =
    `${shown.length} of ${jobs.length} matching listings · ${saved.length}/${BOOKMARK_LIMIT} bookmarked in this workspace`;
  $("#loadMoreJobs").hidden = shown.length >= jobs.length;
  if (!jobs.length)
    empty(
      list,
      $("#jobSavedOnly").checked
        ? "No saved listings match. Bookmark an opportunity from retrieved results, or clear your filters."
        : currentJobs.length
          ? "No retrieved listings match these filters. Try broader criteria; no vacancies are fabricated."
          : "Your next opportunity starts with a search. Choose Find opportunities to request the configured Remotive source. No sample jobs are shown.",
    );
  for (const job of shown) {
    const card = node("article", "directory-card job-card");
    const header = node("div", "job-card-header");
    const employer = node("div");
    employer.append(
      node("p", "eyebrow", job.company),
      node("h3", null, job.title),
    );
    header.append(companyIdentity(job.company), employer);
    card.append(
      header,
      node(
        "p",
        "helper",
        `${job.location || "Location not supplied"} · ${reportedArrangement(job)}`,
      ),
      node("p", "job-salary", job.salary || "Salary not supplied"),
    );
    const tags = node("div", "job-tags");
    for (const text of [
      job.category,
      job.employmentType?.replaceAll("_", " "),
      ...job.tags.slice(0, 4),
    ].filter(Boolean))
      tags.append(node("span", null, text));
    card.append(
      tags,
      node(
        "p",
        "helper",
        `Posted: ${job.postedAt || "Not supplied"} · Source: ${job.source}`,
      ),
    );
    if ($("#jobSavedOnly").checked)
      card.append(
        node(
          "p",
          "helper",
          "Saved listing — availability may have changed. Verify details at the source.",
        ),
      );
    if (job.descriptionText)
      card.append(
        node(
          "p",
          "job-result-excerpt",
          job.descriptionText.replace(/\s+/g, " ").slice(0, 155) +
            (job.descriptionText.length > 155 ? "…" : ""),
        ),
      );
    const bookmark = action(
      saved.some((j) => jobKey(j) === jobKey(job))
        ? "Remove bookmark"
        : "Bookmark opportunity",
      () => toggleJobBookmark(job),
    );
    bookmark.setAttribute(
      "aria-pressed",
      String(saved.some((j) => jobKey(j) === jobKey(job))),
    );
    const jobActions = node("div", "job-card-actions");
    jobActions.append(bookmark);
    card.dataset.saved = String(saved.some((j) => jobKey(j) === jobKey(job)));
    if (safeUrl(job.url)) {
      const link = node("a", "text-link", "View source & apply");
      link.href = safeUrl(job.url);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      jobActions.append(link);
    }
    jobActions.append(
      action("View details", () => openJobDetails(job)),
      action("Save to tracker", () => saveJobToTracker(job)),
    );
    card.append(jobActions);
    list.append(card);
  }
}
function toggleJobBookmark(job) {
  return store.update((next) => {
    const bookmarks = bookmarkedJobs(next.preferences);
    const exists = bookmarks.some((j) => jobKey(j) === jobKey(job));
    if (!exists && bookmarks.length >= BOOKMARK_LIMIT)
      throw new Error(
        `You can keep ${BOOKMARK_LIMIT} job bookmarks. Remove one before adding another.`,
      );
    const raw = Array.isArray(next.preferences.savedJobs)
      ? next.preferences.savedJobs
      : [];
    next.preferences.savedJobs = exists
      ? raw.filter((row) => !row || jobKey(row) !== jobKey(job))
      : [...raw, bookmarkRecord(job)];
    if (!exists) assertBookmarkBudget(next.preferences);
  });
}
function saveJobToTracker(job) {
  return store.update((next) => {
    const id = `job:remotive:${job.id}`;
    if (next.applications.some((a) => a.id === id || a.sourceId === id))
      throw new Error("This job is already in your tracker.");
    window.launchpadCommercial?.checkNewApplication(next.applications.length);
    next.applications.push(
      recordApplicationUpdate(
        null,
        validateApplication({
          id,
          sourceId: id,
          company: job.company.slice(0, 80),
          role: job.title.slice(0, 100),
          country: "Other",
          location: job.location || "",
          arrangement: ["Remote", "Hybrid", "On-site"].includes(
            reportedArrangement(job),
          )
            ? reportedArrangement(job)
            : "Unspecified",
          status: "Saved",
          priority: "Medium",
          deadline: "",
          url: safeUrl(job.url),
          notes: `Source: ${job.source || "Remotive"}. Location and salary are provider text; review country before applying. Salary: ${job.salary || "not supplied"}.`,
          createdAt: new Date().toISOString(),
        }),
      ),
    );
  });
}
$("#coachForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (store.mode !== "account") {
    $("#coachStatus").textContent =
      "Sign in to a verified account to use AI. Guest data is not sent.";
    return;
  }
  if (!["16-17", "18+"].includes(snapshot.profile.age_band)) {
    $("#coachStatus").textContent =
      "Complete your age-appropriate profile onboarding in Settings first.";
    return;
  }
  const submit = event.currentTarget.querySelector("button[type=submit]");
  if (submit.disabled) return;
  const requestTicket = ++coachRequest;
  submit.disabled = true;
  submit.textContent = "Thinking…";
  $("#coachForm").setAttribute("aria-busy", "true");
  document.querySelector("#coachView").dataset.coachState = "loading";
  $("#coachQuestionPreview").textContent = $("#coachPrompt").value;
  $("#coachResponse").textContent = "";
  $("#coachStatus").textContent = "Waiting for the configured AI provider…";
  currentPlan = null;
  const requestOwner = store.owner.id;
  $("#planActions").replaceChildren();
  try {
    const result = await invoke("ai-coach", {
      prompt: $("#coachPrompt").value,
      intent: $("#coachIntent").value,
      consent: {
        profile: $("#shareProfile").checked,
        goals: $("#shareGoals").checked,
        progress: $("#shareProgress").checked,
        history: $("#saveExchange").checked,
        historyContext: $("#shareHistory").checked,
      },
    });
    if (
      requestTicket !== coachRequest ||
      store.mode !== "account" ||
      store.owner?.id !== requestOwner
    )
      return;
    $("#coachResponse").textContent =
      typeof result.response === "string"
        ? result.response
        : JSON.stringify(result.response, null, 2);
    document.querySelector("#coachView").dataset.coachState = "received";
    $("#coachStatus").textContent =
      `Response received from ${result.provider || "the configured AI provider"}. ${result.remaining ?? "Limited"} requests remaining today. ${result.warning || ""}`;
    if (result.plan) {
      if (
        !Array.isArray(result.plan.milestones) ||
        result.plan.milestones.length > 20
      )
        throw new Error("The provider returned an invalid roadmap.");
      currentPlan = result.plan;
      $("#planActions").append(
        action(
          "Add these milestones to my roadmap",
          async () => {
            if (
              !confirm(
                "Add this AI-generated plan? Review its dates and recommendations first.",
              )
            )
              return;
            await store.update((next) => {
              next.milestones.push(
                ...currentPlan.milestones.map((m) => ({
                  id: uid(),
                  title: String(m.title).slice(0, 200),
                  kind: m.kind || "Weekly",
                  targetDate: m.targetDate || "",
                  notes: String(m.notes || "").slice(0, 2000),
                  completed: false,
                })),
              );
            });
            navigate("roadmap");
          },
          true,
        ),
      );
    }
    if ($("#saveExchange").checked) await store.refresh();
  } catch (error) {
    if (requestTicket === coachRequest) {
      document.querySelector("#coachView").dataset.coachState = "error";
      $("#coachStatus").textContent = "AI Coach unavailable: " + error.message;
    }
  } finally {
    if (requestTicket === coachRequest) {
      submit.disabled = false;
      submit.textContent = "Ask coach";
      $("#coachForm").removeAttribute("aria-busy");
    }
  }
});
$("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  // Capture the submitted values now: an earlier queued cloud save can render
  // the form before this update runs.
  const profile = {
    display_name: $("#profileName").value.trim(),
    title: $("#profileTitle").value.trim(),
    country: $("#profileCountry").value.trim(),
    age_band: $("#profileAge").value,
  };
  const preferences = {
    onboarded: true,
    saveCoachHistory: $("#historyPreference").checked,
    emailReminders: $("#emailPreference").checked,
  };
  store
    .update((next) => {
      next.profile = { ...next.profile, ...profile };
      next.preferences = { ...next.preferences, ...preferences };
    })
    .then(() => {
      $("#settingsStatus").textContent =
        "Profile and preferences saved in the active workspace.";
    })
    .catch(report);
});
$("#deleteAccountBtn").addEventListener("click", async () => {
  try {
    if (store.mode !== "account")
      throw new Error("Open your verified account workspace first.");
    const deletionOwner = { ...store.owner };
    if (!$("#deletePassword").value)
      throw new Error("Enter your current password to reauthenticate.");
    if (
      !confirm(
        `Permanently delete ${deletionOwner.email} and all of its cloud data? Export a backup first. Guest records will remain.`,
      )
    )
      return;
    const client = await getAuthClient();
    const { error } = await client.auth.signInWithPassword({
      email: deletionOwner.email,
      password: $("#deletePassword").value,
    });
    $("#deletePassword").value = "";
    if (error) throw new Error("Reauthentication failed. Check your password.");
    await invoke("delete-account", {
      confirmation: "DELETE",
      expected_user: deletionOwner.id,
    });
    if (window.launchpadSession?.id === deletionOwner.id) {
      await client.auth.signOut({ scope: "local" });
      await store.enter(null);
    }
    $("#settingsStatus").textContent =
      "Your account was deleted. Guest records remain on this device.";
  } catch (error) {
    $("#settingsStatus").textContent = error.message;
  } finally {
    $("#deletePassword").value = "";
  }
});
$("#feedbackForm").addEventListener("submit", (event) => {
  event.preventDefault();
  store
    .feedback($("#feedbackText").value.trim())
    .then(() => {
      report("Feedback saved for review. Thank you.");
      $("#feedbackText").value = "";
    })
    .catch(report);
});
$("#downloadFeedback").addEventListener("click", () =>
  download("launchpad-feedback.json", {
    feedback: $("#feedbackText").value.trim(),
    version: "4.0 RC",
  }),
);
$("#privacyActions").append(
  action("Clear guest records", async () => {
    if (store.mode !== "guest")
      throw new Error(
        "Switch to guest mode first. Account records will not be cleared.",
      );
    if (
      confirm(
        "Permanently clear guest opportunities, plans, tasks, favorites and profile from this browser? Export a JSON backup first. Account cloud data will not be deleted.",
      )
    )
      await store.clearGuest();
  }),
  action("Export all personal data", async () =>
    download("launchpad-personal-data.json", await store.exportAll()),
  ),
  action("Import guest records into this account", () =>
    window.launchpadWorkspace.importGuest(),
  ),
  action("Delete saved AI history", async () => {
    if (confirm("Delete all saved AI planning history?"))
      await store.clearHistory();
  }),
);
for (const [label, path] of [
  ["Privacy Policy draft", "legal/privacy.html"],
  ["Terms of Service draft", "legal/terms.html"],
]) {
  const a = node("a", "button button-outline", label);
  a.href = path;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  $("#legalLinks").append(a);
}
$("#landingActions").append(
  action("Launch your workspace", () => navigate("dashboard"), true),
  action("Create an account", () => {
    $("#accountBtn").click();
    $("#signUpMode").click();
  }),
);
$("#landingLinks").append(
  action("Explore companies", () => navigate("companies")),
  action("See the roadmap", () => navigate("roadmap")),
  action("Privacy & terms", () => navigate("settings")),
);
$("#dashboardActions").append(
  action("Add opportunity", () => window.launchpadData.openForm(), true),
  action("View analytics", () => navigate("analytics")),
);
$("#addTaskBtn").addEventListener("click", () => taskEditor());
$("#refreshReminders").addEventListener("click", renderReminders);
$("#addCompanyBtn").addEventListener("click", addCompany);
for (const id of [
  "companySearch",
  "companyIndustry",
  "companyCountry",
  "favoritesOnly",
])
  $("#" + id).addEventListener("input", renderCompanies);
$("#roadmapActions").append(
  action("Add goal", () => goalEditor()),
  action("Add milestone", () => milestoneEditor()),
  action(
    "Create starter roadmap",
    () => {
      if (!snapshot.goals.length) throw new Error("Add a career goal first.");
      if (
        snapshot.milestones.length &&
        !confirm(
          "Add a starter plan alongside your existing milestones? Existing progress will be preserved.",
        )
      )
        return;
      return store.update((next) =>
        next.milestones.push(...starterRoadmap(next.goals[0])),
      );
    },
    true,
  ),
  action("Plan with AI", () => {
    navigate("coach");
    $("#coachIntent").value = "roadmap";
    $("#coachPrompt").value =
      "Help me create a realistic learning roadmap for my saved career goal.";
    $("#shareGoals").checked = true;
  }),
);
$("#boardViewBtn").addEventListener("click", () => {
  boardMode = true;
  $("#boardViewBtn").setAttribute("aria-pressed", "true");
  $("#tableViewBtn").setAttribute("aria-pressed", "false");
  renderBoard(window.launchpadData.visible());
});
$("#tableViewBtn").addEventListener("click", () => {
  boardMode = false;
  $("#boardViewBtn").setAttribute("aria-pressed", "false");
  $("#tableViewBtn").setAttribute("aria-pressed", "true");
  window.launchpadData.replace(store.snapshot);
});
function refreshIfIdle() {
  if (
    store.mode === "account" &&
    !document.querySelector("dialog[open]") &&
    !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)
  )
    store
      .checkRevision()
      .catch((error) => report("Cloud refresh unavailable: " + error.message));
}
window.addEventListener("focus", refreshIfIdle);
setInterval(() => {
  if (snapshot) renderReminders();
  refreshIfIdle();
}, 60000);
await store.enter(window.launchpadSession || null);
navigate(location.hash.slice(1));
