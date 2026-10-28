/**
 * Launchpad — a deliberately framework-free, beginner-friendly portfolio project.
 * The guest dashboard uses localStorage; optional account/cloud copies live in separate modules.
 */
(() => {
  "use strict";
  const STORAGE_KEY = "launchpad-opportunities-v1";
  const MILESTONES_KEY = "launchpad-roadmap-v1";
  const THEME_KEY = "launchpad-theme-v1";
  const $ = (selector) => document.querySelector(selector);

  const milestones = [
    {
      period: "OCT–DEC 2026",
      title: "Ship your first web app",
      detail:
        "Learn HTML, CSS, and JavaScript; customize this very project and publish it on GitHub Pages.",
    },
    {
      period: "JAN–MAR 2027",
      title: "Complete computer science fundamentals",
      detail:
        "Finish CS50x or its core assignments. Learn Git, algorithms, arrays, objects and debugging.",
    },
    {
      period: "APR–JUN 2027",
      title: "Build an impressive portfolio",
      detail:
        "Publish two additional projects: an API-based app and a full-stack app. Write good README files in English.",
    },
    {
      period: "BY SEP 2027",
      title: "Prepare for your international applications",
      detail:
        "Write a one-page CV in English, collect transcripts and investigate eligibility and proof of funds. For Spain, develop Spanish to B1/B2 and research official vocational education (FP) requirements.",
    },
    {
      period: "SEP 2027–MAR 2028",
      title: "Apply to 2028 opportunities",
      detail:
        "Research 2028 Spanish DAW vocational programmes (FP Superior), admission and legal student pathways. Track real deadlines and prepare interview practice.",
    },
    {
      period: "DURING 2028",
      title: "Secure admission, finances and the correct visa",
      detail:
        "Confirm current requirements with the institution and official consular portal before travelling. Do not travel expecting a tourist visa to allow work.",
    },
  ];
  const state = {
    applications: readJson(STORAGE_KEY, []),
    completed: readJson(MILESTONES_KEY, []),
    editId: null,
    search: "",
    status: "all",
    sort: "newest",
    priority: "all",
    arrangement: "all",
    country: "all",
  };
  if (!Array.isArray(state.applications)) state.applications = [];
  if (!Array.isArray(state.completed)) state.completed = [];

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  function saveJsonEntries(entries) {
    const previous = new Map();
    const written = [];
    try {
      // Read/serialize everything before the first write; keep old values for restore rollback.
      const serialized = entries.map(([key, value]) => {
        previous.set(key, localStorage.getItem(key));
        return [key, JSON.stringify(value)];
      });
      for (const [key, value] of serialized) {
        localStorage.setItem(key, value);
        written.push(key);
      }
      return true;
    } catch {
      let rollbackFailed = false;
      for (const key of written.reverse()) {
        try {
          const old = previous.get(key);
          if (old === null) localStorage.removeItem(key);
          else localStorage.setItem(key, old);
        } catch {
          rollbackFailed = true;
        }
      }
      toast(
        rollbackFailed
          ? "Storage failed. Keep this tab open and download a JSON backup before continuing."
          : "Storage is unavailable. No changes were saved. Please free space or download a JSON backup.",
      );
      return false;
    }
  }
  function saveJson(key, value) {
    return saveJsonEntries([[key, value]]);
  }
  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 3500);
  }
  function isoToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function daysToDate(dateString) {
    if (!dateString) return null;
    const [y, m, d] = dateString.split("-").map(Number);
    if (!y || !m || !d) return null;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const other = new Date(y, m - 1, d, 12, 0, 0, 0);
    return Math.round((other - today) / 86400000);
  }
  function formatDate(value) {
    if (!value) return "—";
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T12:00:00`))
    )
      return "—";
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
  }
  function safeUrl(value) {
    if (!value || !value.trim()) return "";
    try {
      const u = new URL(value.trim());
      return ["http:", "https:"].includes(u.protocol) ? u.href : "";
    } catch {
      return "";
    }
  }
  function make(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = String(content);
    return el;
  }
  function updateStats() {
    const apps = state.applications;
    $("#statTotal").textContent = apps.length;
    $("#statApplied").textContent = apps.filter((a) =>
      [
        "Applied",
        "Interview",
        "Offer",
        "Hired",
        "Rejected",
        "Withdrawn",
      ].includes(a.status),
    ).length;
    $("#statInterviews").textContent = apps.filter(
      (a) => a.status === "Interview",
    ).length;
    $("#statDeadlines").textContent = apps.filter((a) => {
      const delta = daysToDate(a.deadline);
      return (
        delta !== null &&
        delta >= 0 &&
        delta <= 14 &&
        !["Rejected", "Offer", "Hired", "Withdrawn"].includes(a.status)
      );
    }).length;
  }
  function filteredApplications() {
    const q = state.search.trim().toLowerCase();
    return state.applications
      .filter(
        (a) =>
          (!q ||
            [a.company, a.role, a.country, a.notes].some((x) =>
              String(x || "")
                .toLowerCase()
                .includes(q),
            )) &&
          (state.status === "all" || a.status === state.status) &&
          (state.priority === "all" ||
            (a.priority || "Medium") === state.priority) &&
          (state.arrangement === "all" ||
            a.arrangement === state.arrangement) &&
          (state.country === "all" || a.country === state.country),
      )
      .sort((a, b) => {
        if (state.sort === "company") return a.company.localeCompare(b.company);
        if (state.sort === "deadline")
          return (a.deadline || "9999-12-31").localeCompare(
            b.deadline || "9999-12-31",
          );
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
  }
  function renderApplications() {
    updateStats();
    const countryFilter = $("#countryFilter");
    const selectedCountry = countryFilter.value;
    countryFilter.replaceChildren(new Option("All countries", "all"));
    for (const name of [
      ...new Set(state.applications.map((a) => a.country)),
    ].sort())
      countryFilter.add(new Option(name, name));
    countryFilter.value = [...countryFilter.options].some(
      (o) => o.value === selectedCountry,
    )
      ? selectedCountry
      : "all";
    state.country = countryFilter.value;
    const all = state.applications;
    const visible = filteredApplications();
    $("#visibleCount").textContent = visible.length;
    $("#emptyState").hidden = all.length !== 0;
    $("#tableWrap").hidden = visible.length === 0;
    $("#noMatches").hidden = all.length === 0 || visible.length !== 0;
    const body = $("#applicationsBody");
    body.replaceChildren();
    visible.forEach((a) => {
      const tr = make("tr");
      const company = make("td");
      company.append(
        make("strong", null, a.company),
        make("small", null, a.role),
      );
      const country = make("td", null, a.country);
      country.dataset.label = "Country";
      const statusCell = make("td");
      statusCell.dataset.label = "Status";
      statusCell.append(
        make("span", `status-pill status-${a.status}`, a.status),
      );
      const deadline = make("td");
      deadline.dataset.label = "Deadline";
      deadline.append(make("span", null, formatDate(a.deadline)));
      if (a.deadline) {
        const days = daysToDate(a.deadline);
        if (days !== null && days >= 0 && days <= 7) {
          deadline.append(
            make(
              "small",
              null,
              days === 0 ? " · Due today" : ` · ${days}d left`,
            ),
          );
        }
      }
      const actionCell = make("td", "actions");
      const actions = make("div", "row-actions");
      actionCell.append(actions);
      if (safeUrl(a.url)) {
        const link = make("a", "tiny-action", "Open posting");
        link.href = safeUrl(a.url);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", `Open posting for ${a.company}`);
        actions.append(link);
      }
      const history = make("button", "tiny-action", "History");
      history.type = "button";
      history.addEventListener("click", () =>
        window.launchpadWorkspace54?.history(a),
      );
      actions.append(history);
      const edit = make("button", "tiny-action", "Edit");
      edit.type = "button";
      edit.addEventListener("click", () => openForm(a));
      actions.append(edit);
      const del = make("button", "tiny-action danger", "Delete");
      del.type = "button";
      del.addEventListener("click", () => deleteApplication(a.id));
      actions.append(del);
      tr.append(company, country, statusCell, deadline, actionCell);
      body.append(tr);
    });
    window.dispatchEvent(
      new CustomEvent("launchpad:render", { detail: visible }),
    );
  }
  function openForm(application) {
    state.editId = application?.id || null;
    $("#applicationForm").reset();
    $("#formError").hidden = true;
    $("#formTitle").textContent = application
      ? "Edit opportunity"
      : "Add opportunity";
    $("#submitDialogBtn").textContent = application
      ? "Update opportunity"
      : "Save opportunity";
    if (
      application &&
      application.country &&
      !Array.from($("#country").options).some(
        (o) => o.value === application.country,
      )
    ) {
      $("#country").add(new Option(application.country, application.country));
    }
    if (application) {
      [
        "company",
        "role",
        "country",
        "status",
        "deadline",
        "url",
        "notes",
        "location",
        "arrangement",
        "salaryMin",
        "salaryMax",
        "currency",
        "salaryPeriod",
        "applicationDate",
        "priority",
        "interviewAt",
        "followUp",
      ].forEach((key) => {
        if (
          application[key] !== undefined &&
          application[key] !== null &&
          application[key] !== ""
        )
          $(`#${key}`).value = application[key];
      });
    }
    $("#applicationDialog").showModal();
    $("#company").focus();
  }
  $("#applicationDialog").addEventListener("close", () => {
    state.editId = null;
  });
  function closeForm() {
    $("#applicationDialog").close();
    state.editId = null;
  }
  async function handleSubmit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    if (!state.editId) {
      try {
        window.launchpadCommercial?.checkNewApplication(
          state.applications.length,
        );
      } catch (error) {
        $("#formError").textContent = error.message;
        $("#formError").hidden = false;
        return;
      }
    }
    [
      "company",
      "role",
      "country",
      "status",
      "deadline",
      "url",
      "notes",
      "location",
      "arrangement",
      "salaryMin",
      "salaryMax",
      "currency",
      "salaryPeriod",
      "applicationDate",
      "priority",
      "interviewAt",
      "followUp",
    ].forEach((k) => (fields[k] = String(fields[k] || "").trim()));
    const error = $("#formError");
    if (!fields.company || !fields.role || !fields.country) {
      error.hidden = false;
      error.textContent =
        "Please fill out the company, role, and country fields.";
      return;
    }
    if (fields.url && !safeUrl(fields.url)) {
      error.hidden = false;
      error.textContent = "The job link must start with https:// or http://.";
      return;
    }
    fields.url = safeUrl(fields.url);
    const existing = state.applications.find((a) => a.id === state.editId);
    if (
      fields.salaryMin !== "" &&
      fields.salaryMax !== "" &&
      Number(fields.salaryMin) > Number(fields.salaryMax)
    ) {
      error.hidden = false;
      error.textContent =
        "The minimum salary cannot exceed the maximum salary.";
      return;
    }
    if (!$("#applicationForm").reportValidity()) return;
    let updated = {
      ...existing,
      ...fields,
      id:
        existing?.id ||
        crypto.randomUUID?.() ||
        `${Date.now()}-${Math.random()}`,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    updated = window.launchpadHistory?.record(existing, updated) || updated;
    const applications = existing
      ? state.applications.map((a) => (a.id === existing.id ? updated : a))
      : [...state.applications, updated];
    if (!(await persistEntries([[STORAGE_KEY, applications]]))) return;
    state.applications = applications;
    closeForm();
    renderApplications();
    notifyChanged();
    toast(existing ? "Opportunity updated!" : "Opportunity added!");
  }
  async function deleteApplication(id) {
    const item = state.applications.find((a) => a.id === id);
    if (!item || !window.confirm(`Delete ${item.company} — ${item.role}?`))
      return;
    const applications = state.applications.filter((a) => a.id !== id);
    if (!(await persistEntries([[STORAGE_KEY, applications]]))) return;
    state.applications = applications;
    renderApplications();
    notifyChanged();
    toast("Opportunity deleted.");
  }
  async function demo() {
    if (
      state.applications.length &&
      !window.confirm("Append sample applications to your existing list?")
    )
      return;
    const samples = [
      {
        company: "Example Software GmbH",
        role: "Software Development Apprenticeship",
        country: "Germany",
        status: "Saved",
        deadline: "",
        url: "",
        notes: "SAMPLE ONLY — replace with a real opportunity.",
      },
      {
        company: "Demo Tech Studio",
        role: "Junior Frontend Developer",
        country: "Ireland",
        status: "Applied",
        deadline: "",
        url: "",
        notes: "SAMPLE ONLY — fictitious company.",
      },
      {
        company: "Practice Labs",
        role: "Computer Science Internship",
        country: "United States",
        status: "Interview",
        deadline: "",
        url: "",
        notes: "SAMPLE ONLY — fictitious company.",
      },
    ];
    const applications = [
      ...state.applications,
      ...samples.map((a, i) => ({
        ...a,
        id: crypto.randomUUID?.() || `${Date.now()}-${i}`,
        createdAt: new Date(Date.now() + i).toISOString(),
      })),
    ];
    if (!(await persistEntries([[STORAGE_KEY, applications]]))) return;
    state.applications = applications;
    renderApplications();
    notifyChanged();
    toast("Sample entries added — these are not real job listings.");
  }
  function exportCsv() {
    const columns = [
      "company",
      "role",
      "country",
      "status",
      "deadline",
      "url",
      "notes",
      "location",
      "arrangement",
      "salaryMin",
      "salaryMax",
      "currency",
      "salaryPeriod",
      "applicationDate",
      "priority",
      "interviewAt",
      "followUp",
    ];
    const safeCsvCell = (value) => {
      const original = String(value ?? "");
      const guarded = /^[\s]*[=+\-@]/.test(original)
        ? `\'${original}`
        : original;
      return `\"${guarded.replace(/\"/g, '\"\"')}\"`;
    };
    const csv = [
      columns.join(","),
      ...state.applications.map((a) =>
        columns.map((key) => safeCsvCell(a[key])).join(","),
      ),
    ].join("\r\n");
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `launchpad-applications-${isoToday()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 3000);
    toast("CSV downloaded. Keep a backup of your data.");
  }
  function download(name, mime, content) {
    const blob = new Blob([content], { type: mime });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 3000);
  }
  function backupJson() {
    const payload = window.launchpadWorkspace?.backup() || {
      app: "launchpad",
      formatVersion: 1,
      savedAt: new Date().toISOString(),
      applications: state.applications,
      completed: state.completed,
    };
    download(
      `launchpad-backup-${isoToday()}.json`,
      "application/json",
      JSON.stringify(payload, null, 2),
    );
    toast("Backup downloaded. Store it somewhere safe.");
  }
  function sanitizedApplication(a) {
    if (!a || typeof a !== "object" || Array.isArray(a)) return null;
    const text = (key, max) =>
      typeof a[key] === "string" ? a[key].trim().slice(0, max) : "";
    const company = text("company", 80),
      role = text("role", 100),
      country = text("country", 60);
    if (!company || !role || !country) return null;
    const validStatuses = [
      "Saved",
      "Applied",
      "Interview",
      "Offer",
      "Hired",
      "Rejected",
      "Withdrawn",
    ];
    const status = validStatuses.includes(a.status) ? a.status : "Saved";
    const deadline = text("deadline", 10);
    const parsedDeadline = /^\d{4}-\d{2}-\d{2}$/.test(deadline)
      ? new Date(`${deadline}T12:00:00Z`)
      : null;
    const validDate =
      parsedDeadline &&
      !Number.isNaN(parsedDeadline.getTime()) &&
      parsedDeadline.toISOString().slice(0, 10) === deadline;
    const extra = {};
    for (const key of [
      "location",
      "arrangement",
      "salaryMin",
      "salaryMax",
      "currency",
      "salaryPeriod",
      "applicationDate",
      "priority",
      "interviewAt",
      "followUp",
    ])
      if (typeof a[key] === "string" || typeof a[key] === "number")
        extra[key] = String(a[key]).slice(0, 200);
    if (Array.isArray(a.updates))
      extra.updates = a.updates
        .filter(
          (x) =>
            x &&
            typeof x.at === "string" &&
            Number.isFinite(Date.parse(x.at)) &&
            typeof x.summary === "string",
        )
        .slice(-20)
        .map((x) => ({
          at: x.at,
          summary: x.summary.slice(0, 240),
          type: ["created", "status", "edited"].includes(x.type)
            ? x.type
            : "edited",
        }));
    if (
      typeof a.updatedAt === "string" &&
      Number.isFinite(Date.parse(a.updatedAt))
    )
      extra.updatedAt = a.updatedAt;
    return {
      ...extra,
      company,
      role,
      country,
      status,
      deadline: validDate ? deadline : "",
      url: safeUrl(text("url", 2000)),
      notes: text("notes", 700),
      id:
        typeof a.id === "string" && a.id.trim() && a.id.length <= 200
          ? a.id
          : crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      createdAt:
        typeof a.createdAt === "string" &&
        !Number.isNaN(Date.parse(a.createdAt))
          ? a.createdAt
          : new Date().toISOString(),
    };
  }
  async function restoreJson(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 8_000_000) {
      toast("Backup is too large (8 MB maximum).");
      return;
    }
    try {
      const raw = JSON.parse(await file.text());
      if (
        !raw ||
        raw.app !== "launchpad" ||
        raw.formatVersion !== 1 ||
        !Array.isArray(raw.applications) ||
        !Array.isArray(raw.completed) ||
        raw.applications.length > 1000
      )
        throw new Error("Invalid backup file.");
      const applications = raw.applications.map(sanitizedApplication);
      if (
        applications.every(Boolean) &&
        new Set(applications.map((a) => a.id)).size !== applications.length
      )
        throw new Error("Backup contains duplicate application IDs.");
      if (applications.some((a) => !a))
        throw new Error("Backup has invalid application entries.");
      const completed = [
        ...new Set(
          raw.completed.filter(
            (i) => Number.isInteger(i) && i >= 0 && i < milestones.length,
          ),
        ),
      ];
      if (
        !window.confirm(
          `Replace your current ${state.applications.length} entries with ${applications.length} entries from this backup?`,
        )
      )
        return;
      if (raw.extras && window.launchpadWorkspace) {
        await window.launchpadWorkspace.restoreBackup(
          applications,
          completed,
          raw.extras,
        );
        toast("Backup restored successfully.");
        return;
      }
      if (
        !(await persistEntries([
          [STORAGE_KEY, applications],
          [MILESTONES_KEY, completed],
        ]))
      )
        return;
      state.applications = applications;
      state.completed = completed;
      state.editId = null;
      renderApplications();
      renderMilestones();
      notifyChanged();
      toast("Backup restored successfully.");
    } catch (err) {
      toast(`Restore failed: ${err.message}`);
    }
  }
  function renderMilestones() {
    const list = $("#milestoneList");
    list.replaceChildren();
    milestones.forEach((m, i) => {
      const label = make("label", "milestone");
      const check = make("input");
      check.type = "checkbox";
      check.checked = state.completed.includes(i);
      check.setAttribute("aria-label", `Mark ${m.title} complete`);
      check.addEventListener("change", async () => {
        const completed = check.checked
          ? [...new Set([...state.completed, i])]
          : state.completed.filter((x) => x !== i);
        if (!(await persistEntries([[MILESTONES_KEY, completed]]))) {
          check.checked = state.completed.includes(i);
          return;
        }
        state.completed = completed;
        renderMilestones();
        notifyChanged();
      });
      const content = make("div");
      content.append(
        make("h3", null, m.title),
        make("p", null, m.detail),
        make("time", null, m.period),
      );
      label.append(check, content);
      list.append(label);
    });
    $("#roadmapProgressLabel").textContent =
      `${state.completed.length} / ${milestones.length} milestones complete`;
    const pct = Math.round((state.completed.length / milestones.length) * 100);
    $("#roadmapPercent").textContent = `${pct}%`;
    $("#roadmapProgressBar").style.width = `${pct}%`;
  }
  let activeView = null;
  function setView(view) {
    const routes = [
      "home",
      "dashboard",
      "applications",
      "roadmap",
      "companies",
      "jobs",
      "coach",
      "analytics",
      "settings",
      "billing",
      "business",
      "resume",
      "interview",
    ];
    const route = view.split("?")[0];
    const current = routes.includes(route) ? route : "applications";
    document
      .querySelectorAll(".view")
      .forEach((section) => (section.hidden = section.id !== current + "View"));
    $("#breadcrumbPage").textContent =
      current === "roadmap" ? "CAREER ROADMAP" : current.toUpperCase();
    document.querySelectorAll(".nav-item").forEach((button) => {
      const active = button.dataset.view === current;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (!location.hash || routes.some((route) => location.hash === "#" + route))
      location.hash = current;
    // A navigation click updates immediately; its later hashchange must not
    // render the same screen again and overwrite edits made in the meantime.
    // Still update visibility above when platform.js adds its screens at startup.
    if (activeView === current) return;
    activeView = current;
    window.dispatchEvent(
      new CustomEvent("launchpad:navigate", { detail: current }),
    );
  }
  function setTheme(dark) {
    document.body.classList.toggle("dark", dark);
    $("#themeToggle").textContent = dark ? "☀" : "☾";
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {}
  }
  $(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    $("#mainContent").focus();
  });
  $("#addApplicationBtn").addEventListener("click", () => openForm());
  $("#emptyAddBtn").addEventListener("click", () => openForm());
  $("#loadDemoBtn").addEventListener("click", demo);
  $("#closeDialogBtn").addEventListener("click", closeForm);
  $("#cancelDialogBtn").addEventListener("click", closeForm);
  $("#applicationForm").addEventListener("submit", handleSubmit);
  $("#searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderApplications();
  });
  $("#statusFilter").addEventListener("change", (event) => {
    state.status = event.target.value;
    renderApplications();
  });
  for (const [id, key] of [
    ["arrangementFilter", "arrangement"],
    ["countryFilter", "country"],
  ])
    $("#" + id).addEventListener("change", (event) => {
      state[key] = event.target.value;
      renderApplications();
    });
  $("#priorityFilter").addEventListener("change", (event) => {
    state.priority = event.target.value;
    renderApplications();
  });
  $("#sortSelect").addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderApplications();
  });
  $("#exportBtn").addEventListener("click", exportCsv);
  $("#backupBtn").addEventListener("click", backupJson);
  $("#restoreBtn").addEventListener("click", () => $("#restoreFile").click());
  $("#restoreFile").addEventListener("change", restoreJson);
  $("#themeToggle").addEventListener("click", () =>
    setTheme(!document.body.classList.contains("dark")),
  );
  document
    .querySelectorAll(".nav-item")
    .forEach((button) =>
      button.addEventListener("click", () => setView(button.dataset.view)),
    );
  $("#brandLink").addEventListener("click", (event) => {
    event.preventDefault();
    setView("home");
  });
  window.addEventListener("hashchange", () => setView(location.hash.slice(1)));
  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem(THEME_KEY) || "light";
  } catch {}
  setTheme(savedTheme === "dark");
  let persisting = false;
  async function persistEntries(entries) {
    if (persisting) {
      toast("Please wait for the current save to finish.");
      return false;
    }
    persisting = true;
    $("#submitDialogBtn").disabled = true;
    try {
      if (window.launchpadWorkspace?.isAccount()) {
        try {
          await window.launchpadWorkspace.saveTracker(entries);
          return true;
        } catch (error) {
          toast(error.message);
          return false;
        }
      }
      return saveJsonEntries(entries);
    } finally {
      persisting = false;
      $("#submitDialogBtn").disabled = false;
    }
  }
  function notifyChanged() {
    window.dispatchEvent(
      new CustomEvent("launchpad:changed", {
        detail: {
          applications: state.applications,
          completed: state.completed,
        },
      }),
    );
  }
  window.launchpadData = Object.freeze({
    snapshot: () =>
      JSON.parse(
        JSON.stringify({
          app: "launchpad",
          formatVersion: 1,
          applications: state.applications,
          completed: state.completed,
        }),
      ),
    readGuest: () => ({
      applications: readJson(STORAGE_KEY, []),
      completed: readJson(MILESTONES_KEY, []),
    }),
    commitGuest: (snapshot) => {
      const { applications, completed, aiHistory, revision, ...extras } =
        snapshot;
      return saveJsonEntries([
        [STORAGE_KEY, applications],
        [MILESTONES_KEY, completed],
        ["launchpad-workspace-v4", extras],
      ]);
    },
    replace: (snapshot) => {
      state.applications = snapshot.applications;
      state.completed = snapshot.completed;
      renderApplications();
      renderMilestones();
    },
    resetFilters: () => {
      state.search = "";
      state.status = "all";
      state.sort = "newest";
      state.priority = "all";
      state.country = "all";
      state.arrangement = "all";
      $("#searchInput").value = "";
      for (const id of [
        "statusFilter",
        "priorityFilter",
        "countryFilter",
        "arrangementFilter",
      ])
        $("#" + id).value = "all";
      $("#sortSelect").value = "newest";
    },
    navigate: setView,
    openForm,
    visible: filteredApplications,
  });
  renderApplications();
  renderMilestones();
  setView(location.hash.slice(1));
})();
