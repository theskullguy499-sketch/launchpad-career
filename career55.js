import {
  emptyResume,
  validateResume,
  readStudio,
  writeStudio,
  mergeStudio,
  safeCareerUrl,
  MAX_RESUMES,
} from "./lib/career-studio.mjs";
const $ = (s) => document.querySelector(s);
const node = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const action = (text, fn, primary = false) => {
  const b = node(
    "button",
    "button " + (primary ? "button-primary" : "button-outline"),
    text,
  );
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
};
let context,
  mounted = false,
  draft = null,
  dirty = false,
  scope = null,
  savedKey = "",
  printing = null;
let resumeStatus;
function message(text, error = false) {
  resumeStatus.textContent = text;
  resumeStatus.classList.toggle("career-error", error);
}
function consent() {
  if (context.mode === "account" && !$("#studioCloudConsent").checked)
    throw Error(
      "Confirm that you want to save this personal material to your private Supabase workspace.",
    );
}
async function commit(change) {
  consent();
  const ticket = scope;
  await context.update((next) => {
    const studio = structuredClone(readStudio(next.preferences));
    change(studio);
    next.preferences = writeStudio(next.preferences, studio);
  });
  return ticket === scope;
}
function heading(title, copy) {
  const h = node("header", "career-heading");
  h.append(
    node("p", "eyebrow", "YOUR NEXT CHAPTER"),
    node("h1", null, title),
    node("p", "intro-copy", copy),
  );
  return h;
}
function formField(key, label, area = false) {
  const wrap = node("label");
  wrap.append(node("span", null, label));
  const input = node(area ? "textarea" : "input");
  input.id = "resume-" + key;
  input.name = key;
  input.maxLength =
    {
      summary: 1400,
      skills: 1000,
      languages: 500,
      github: 500,
      portfolio: 500,
      email: 160,
      phone: 60,
      label: 80,
    }[key] || 120;
  if (area) input.rows = 3;
  else
    input.type =
      key === "email"
        ? "email"
        : ["github", "portfolio"].includes(key)
          ? "url"
          : "text";
  input.autocomplete = "off";
  input.addEventListener("input", () => {
    draft[key] = input.value;
    dirty = true;
    message("Unsaved changes · choose Save version to keep them.");
    previewResume();
  });
  wrap.append(input);
  return wrap;
}
function mount() {
  if (mounted) return;
  mounted = true;
  const root = $("#resumeView");
  root.append(
    heading(
      "Resume Studio",
      "Build an honest, focused resume in English. Your own projects belong here; they do not need to be employment experience.",
    ),
  );
  const toolbar = node("div", "panel section-pad career-toolbar");
  const label = node("label", null, "Resume version");
  const versions = node("select");
  versions.id = "resumeVersion";
  versions.addEventListener("change", () => selectVersion(versions.value));
  label.append(versions);
  toolbar.append(
    label,
    action("New version", () => newVersion()),
    action("Duplicate version", () => newVersion(true)),
    action("Delete version", deleteVersion),
  );
  root.append(toolbar);
  const privacy = node("section", "panel section-pad career-privacy");
  privacy.append(
    node("h2", null, "Your material, your choice"),
    node(
      "p",
      "helper",
      "Guest drafts stay in this browser profile. Saved account material uses your existing private Supabase workspace. Nothing is sent to an AI provider by this editor.",
    ),
  );
  const cloud = node("label", "check-label");
  const checkbox = node("input");
  checkbox.type = "checkbox";
  checkbox.id = "studioCloudConsent";
  cloud.id = "studioConsentLabel";
  cloud.append(
    checkbox,
    document.createTextNode(
      "I agree to save resume and interview material to my private Supabase workspace.",
    ),
  );
  privacy.append(
    cloud,
    action("Import guest career material", importGuestStudio),
  );
  privacy.lastChild.id = "importGuestStudio";
  root.append(privacy);
  const layout = node("div", "resume-studio-grid");
  const editor = node("form", "panel section-pad resume-editor");
  editor.id = "resumeForm";
  editor.noValidate = true;
  const fields = node("div", "career-form-grid");
  for (const [key, label, area] of [
    ["label", "Version name"],
    ["name", "Full name"],
    ["title", "Professional headline"],
    ["email", "Email (optional)"],
    ["phone", "Phone (optional)"],
    ["location", "Location (optional)"],
    ["github", "GitHub URL (optional)"],
    ["portfolio", "Portfolio URL (optional)"],
    ["summary", "Professional summary", true],
    ["skills", "Skills (comma separated)", true],
    ["languages", "Languages and your declared level", true],
  ])
    fields.append(formField(key, label, area));
  editor.append(fields);
  for (const [key, title] of [
    ["experience", "Work experience"],
    ["education", "Education"],
    ["projects", "Portfolio projects"],
  ]) {
    const group = node("section", "resume-entry-group");
    group.append(
      node("h2", null, title),
      node(
        "p",
        "helper",
        key === "projects"
          ? "Describe only work you actually built, for example your own Launchpad or FinanceFlow Pro project. Leave outcomes blank if you cannot substantiate them."
          : "Leave this section empty if it does not apply. No qualifications are inserted for you.",
      ),
    );
    const list = node("div");
    list.id = "resumeEntries-" + key;
    group.append(
      list,
      action(
        "Add " +
          {
            experience: "experience",
            education: "education",
            projects: "project",
          }[key],
        () => {
          if (draft[key].length >= 8) {
            message("Use up to 8 entries per section.", true);
            return;
          }
          draft[key].push({
            heading: "",
            organization: "",
            period: "",
            description: "",
            url: "",
          });
          dirty = true;
          renderEntries(key);
          previewResume();
        },
      ),
    );
    editor.append(group);
  }
  const save = node("button", "button button-primary", "Save version");
  save.type = "submit";
  save.id = "saveResume";
  editor.append(save);
  editor.addEventListener("submit", saveResume);
  resumeStatus = node("p", "helper");
  resumeStatus.id = "resumeStatus";
  resumeStatus.setAttribute("role", "status");
  editor.append(resumeStatus);
  const preview = node("section", "resume-preview-column");
  const previewControls = node("div", "panel section-pad career-toolbar");
  const templateLabel = node("label", null, "Resume template");
  const template = node("select");
  template.id = "resumeTemplate";
  template.append(
    new Option("Classic · single column", "classic"),
    new Option("Modern · single column", "modern"),
  );
  template.addEventListener("change", () => {
    draft.template = template.value;
    dirty = true;
    previewResume();
  });
  templateLabel.append(template);
  previewControls.append(
    templateLabel,
    action("Print / Save PDF", printResume),
  );
  preview.append(
    previewControls,
    node(
      "p",
      "helper",
      "Text-first, single-column layouts designed for readability. ATS parsing varies; compatibility with every employer system is not guaranteed. PDF generation uses your browser, not an external service.",
    ),
  );
  const paper = node("article", "resume-paper");
  paper.id = "resumePreview";
  paper.setAttribute("aria-label", "Live resume preview");
  preview.append(paper);
  layout.append(editor, preview);
  root.append(layout);
  window.addEventListener("afterprint", clearPrint);
}
function selectVersion(id) {
  if (dirty && !confirm("Discard unsaved resume changes?")) {
    $("#resumeVersion").value = draft.id;
    return;
  }
  const found = readStudio(context.data.preferences).resumes.find(
    (r) => r.id === id,
  );
  draft = structuredClone(found || emptyResume());
  dirty = false;
  fillResume();
  message(
    found
      ? "Saved version loaded."
      : "Start with your own facts. Nothing is saved until you choose Save version.",
  );
}
function newVersion(duplicate = false) {
  if (dirty && !confirm("Discard unsaved resume changes?")) return;
  const data = readStudio(context.data.preferences);
  if (data.resumes.length >= MAX_RESUMES) {
    message(
      "You can keep up to 5 versions. Export a backup before removing an unused version.",
      true,
    );
    return;
  }
  draft = duplicate
    ? {
        ...structuredClone(draft),
        id: crypto.randomUUID(),
        label: draft.label.slice(0, 70) + " copy",
        updatedAt: "",
      }
    : emptyResume();
  dirty = true;
  fillResume();
  message("New draft · not saved yet.");
}
async function saveResume(event) {
  event.preventDefault();
  if (!draft) return;
  const button = $("#saveResume");
  const saveScope = scope;
  const fingerprint = JSON.stringify(draft);
  button.disabled = true;
  try {
    const value = validateResume({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
    dirty = true;
    message(
      "Saving this version… Your draft stays available while the request completes.",
    );
    const ok = await commit((studio) => {
      const index = studio.resumes.findIndex((r) => r.id === value.id);
      if (index < 0) {
        if (studio.resumes.length >= MAX_RESUMES)
          throw Error("Five version limit reached.");
        studio.resumes.push(value);
      } else studio.resumes[index] = value;
    });
    if (ok && JSON.stringify(draft) !== fingerprint) {
      dirty = true;
      refreshVersions();
      message(
        "Version saved. Your newer edits are still unsaved; choose Save version again to keep them.",
      );
    } else if (ok) {
      draft = value;
      dirty = false;
      fillResume();
      message(
        context.mode === "account"
          ? "Resume saved to your private account workspace."
          : "Resume saved on this device. Keep a JSON backup.",
      );
    }
  } catch (e) {
    if (saveScope === scope) message(e.message, true);
  } finally {
    button.disabled = false;
  }
}
async function deleteVersion() {
  if (
    !draft ||
    !confirm(
      "Delete this resume version? Export a JSON backup first if you need to keep it.",
    )
  )
    return;
  try {
    const id = draft.id;
    if (
      await commit((studio) => {
        studio.resumes = studio.resumes.filter((r) => r.id !== id);
      })
    ) {
      draft = null;
      dirty = false;
      selectVersion("");
    }
  } catch (e) {
    message(e.message, true);
  }
}
async function importGuestStudio() {
  try {
    consent();
    const guest = readStudio(context.guestPreferences());
    if (!guest.resumes.length && !guest.practices.length) {
      message("No saved guest career material to import.");
      return;
    }
    if (
      !confirm(
        `Copy ${guest.resumes.length} guest resume versions and ${guest.practices.length} practice exercises into this account? Account versions with the same IDs win. Guest data is kept.`,
      )
    )
      return;
    if (
      await commit((studio) =>
        Object.assign(studio, mergeStudio(studio, guest)),
      )
    )
      message(
        "Guest career material imported explicitly. Guest originals were preserved.",
      );
  } catch (e) {
    message(e.message, true);
  }
}
function refreshVersions() {
  if (!draft || !context) return;
  const versions = $("#resumeVersion");
  versions.replaceChildren();
  for (const r of readStudio(context.data.preferences).resumes)
    versions.add(new Option(r.label, r.id));
  if (![...versions.options].some((o) => o.value === draft.id))
    versions.add(new Option(draft.label + " · draft", draft.id));
  versions.value = draft.id;
}
function fillResume() {
  if (!draft) return;
  for (const input of $("#resumeForm").querySelectorAll(
    ".career-form-grid input,.career-form-grid textarea",
  ))
    input.value = draft[input.name] || "";
  refreshVersions();
  $("#resumeTemplate").value = draft.template;
  for (const key of ["experience", "education", "projects"]) renderEntries(key);
  previewResume();
}
function renderEntries(key) {
  const list = $("#resumeEntries-" + key);
  list.replaceChildren();
  draft[key].forEach((entry, index) => {
    const fieldset = node("fieldset", "resume-entry");
    fieldset.append(
      node(
        "legend",
        null,
        `${key === "projects" ? "Project" : key === "education" ? "Education" : "Experience"} ${index + 1}`,
      ),
    );
    for (const [field, title] of [
      [
        "heading",
        key === "projects"
          ? "Project name"
          : key === "education"
            ? "Qualification / course"
            : "Role",
      ],
      [
        "organization",
        key === "projects"
          ? "Your contribution / context"
          : key === "education"
            ? "Institution"
            : "Employer",
      ],
      ["period", "Dates (your own wording)"],
      ["description", "Description / evidence"],
      ...(key === "projects" ? [["url", "Project URL (optional)"]] : []),
    ]) {
      const label = node("label", null, title);
      const input = node(field === "description" ? "textarea" : "input");
      input.value = entry[field] || "";
      input.maxLength =
        field === "description"
          ? 1400
          : field === "url"
            ? 500
            : field === "period"
              ? 100
              : 160;
      input.setAttribute("aria-label", `${title} · ${key} ${index + 1}`);
      input.addEventListener("input", () => {
        entry[field] = input.value;
        dirty = true;
        previewResume();
      });
      label.append(input);
      fieldset.append(label);
    }
    fieldset.append(
      action("Remove entry", () => {
        draft[key].splice(index, 1);
        dirty = true;
        renderEntries(key);
        previewResume();
      }),
    );
    list.append(fieldset);
  });
}
function resumeDocument(r) {
  const paper = node("article", "resume-paper resume-" + r.template);
  paper.append(
    node("h2", null, r.name || "Your name"),
    node("p", "resume-headline", r.title || "Your professional headline"),
  );
  const contact = node(
    "p",
    "resume-contact",
    [r.email, r.phone, r.location].filter(Boolean).join(" · "),
  );
  paper.append(contact);
  const links = node("p", "resume-contact");
  for (const [name, url] of [
    ["GitHub", r.github],
    ["Portfolio", r.portfolio],
  ])
    if (safeCareerUrl(url)) {
      const a = node("a", null, name + ": " + url);
      a.href = safeCareerUrl(url);
      a.rel = "noopener noreferrer";
      a.target = "_blank";
      links.append(a, document.createTextNode(" "));
    }
  paper.append(links);
  const section = (title, text) => {
    if (!text) return;
    paper.append(node("h3", null, title), node("p", "resume-copy", text));
  };
  section("Profile", r.summary);
  for (const [key, title] of [
    ["experience", "Experience"],
    ["education", "Education"],
    ["projects", "Projects"],
  ]) {
    if (!r[key].length) continue;
    paper.append(node("h3", null, title));
    for (const entry of r[key]) {
      const group = node("section", "resume-output-entry");
      group.append(
        node("h4", null, entry.heading),
        node(
          "p",
          "resume-entry-meta",
          [entry.organization, entry.period].filter(Boolean).join(" · "),
        ),
        node("p", "resume-copy", entry.description),
      );
      if (safeCareerUrl(entry.url)) {
        const a = node("a", null, entry.url);
        a.href = safeCareerUrl(entry.url);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        group.append(a);
      }
      paper.append(group);
    }
  }
  section("Skills", r.skills);
  section("Languages", r.languages);
  return paper;
}
function previewResume() {
  if (!draft) return;
  const live = $("#resumePreview");
  const next = resumeDocument(draft);
  live.className = next.className;
  live.replaceChildren(...next.childNodes);
}
function clearPrint() {
  printing?.remove();
  printing = null;
  document.body.classList.remove("printing-resume");
}
function printResume() {
  clearPrint();
  printing = resumeDocument(draft);
  printing.id = "resumePrintRoot";
  document.body.append(printing);
  document.body.classList.add("printing-resume");
  window.print();
}
export function clearCareer55() {
  context = null;
  scope = null;
  draft = null;
  dirty = false;
  savedKey = "";
  clearPrint();
  if (mounted) {
    $("#resumeForm").reset();
    $("#resumePreview").replaceChildren();
    $("#resumeVersion").replaceChildren();
    for (const key of ["experience", "education", "projects"])
      $("#resumeEntries-" + key).replaceChildren();
    $("#studioCloudConsent").checked = false;
    resumeStatus.textContent = "";
  }
}
export function renderCareer55(next) {
  context = next;
  mount();
  const changed = scope !== next.scope;
  if (changed) {
    scope = next.scope;
    draft = null;
    dirty = false;
    savedKey = "";
    $("#studioCloudConsent").checked = false;
  }
  $("#studioConsentLabel").hidden = next.mode !== "account";
  $("#importGuestStudio").hidden = next.mode !== "account";
  try {
    const data = readStudio(next.data.preferences),
      key = JSON.stringify(data.resumes);
    if (!draft) {
      draft = structuredClone(data.resumes[0] || emptyResume());
      fillResume();
    } else if (!dirty && key !== savedKey) {
      draft = structuredClone(
        data.resumes.find((r) => r.id === draft.id) ||
          data.resumes[0] ||
          emptyResume(),
      );
      fillResume();
    }
    savedKey = key;
  } catch (e) {
    message(e.message, true);
  }
}
