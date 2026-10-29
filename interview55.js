import {
  readStudio,
  writeStudio,
  MAX_PRACTICES,
} from "./lib/career-studio.mjs";
import {
  PRACTICE_QUESTIONS,
  PREPARATION,
  validatePractice,
} from "./lib/interview-practice.mjs";
const $ = (s) => document.querySelector(s),
  el = (t, c, text) => {
    const e = document.createElement(t);
    if (c) e.className = c;
    if (text !== undefined) e.textContent = text;
    return e;
  };
const button = (text, fn) => {
  const b = el("button", "button button-outline", text);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
};
let context,
  scope = null,
  mounted = false,
  exerciseId = null,
  seconds = 0,
  started = 0,
  tick = null,
  historyKey = "",
  checkKey = "";
const question = () =>
  PRACTICE_QUESTIONS.find((q) => q.id === $("#practiceQuestion").value) ||
  PRACTICE_QUESTIONS[0];
const elapsed = () =>
  Math.min(
    86400,
    seconds + (started ? (performance.now() - started) / 1000 : 0),
  );
function clock() {
  const total = Math.floor(elapsed());
  $("#practiceClock").textContent =
    String(Math.floor(total / 60)).padStart(2, "0") +
    ":" +
    String(total % 60).padStart(2, "0");
}
function stop() {
  if (started) seconds = elapsed();
  started = 0;
  clearInterval(tick);
  tick = null;
  if (mounted) {
    $("#practiceTimer").textContent = "Start timer";
    $("#practiceTimer").setAttribute("aria-pressed", "false");
    clock();
  }
}
function status(text, error = false) {
  $("#practiceStatus").textContent = text;
  $("#practiceStatus").classList.toggle("career-error", error);
}
async function update(change) {
  if (context.mode === "account" && !$("#practiceCloudConsent").checked)
    throw Error(
      "Agree to save this interview material to your private Supabase workspace first.",
    );
  const ticket = scope;
  await context.update((next) => {
    const s = structuredClone(readStudio(next.preferences));
    change(s);
    next.preferences = writeStudio(next.preferences, s);
  });
  return ticket === scope;
}
function choose(reset = true) {
  $("#practiceQuestion").dataset.previous = $("#practiceQuestion").value;
  if (reset) {
    stop();
    seconds = 0;
    exerciseId = null;
    $("#practiceAnswer").value = "";
    clock();
  }
  const q = question();
  $("#practicePrompt").textContent = q.prompt;
  $("#practiceGuide").textContent = q.guide;
}
function newExercise() {
  if (
    $("#practiceAnswer").value.trim() &&
    !confirm(
      "Start another exercise? Save your current answer first if you want to keep it.",
    )
  )
    return;
  choose();
  status(
    "New exercise. Static practice material; no AI evaluation has been requested.",
  );
}
function mount() {
  if (mounted) return;
  mounted = true;
  const root = $("#interviewView");
  const heading = el("header", "career-heading");
  heading.append(
    el("p", "eyebrow", "PRACTICE WITH INTENT"),
    el("h1", null, "Interview Lab"),
    el(
      "p",
      "intro-copy",
      "Prepare in English using original static practice questions. Save your own answers, reflect on real projects and build a repeatable routine.",
    ),
  );
  root.append(heading);
  const layout = el("div", "interview-workbench"),
    main = el("section", "panel section-pad interview-practice"),
    rail = el("aside", "interview-rail");
  const tools = el("div", "career-toolbar");
  const topicLabel = el("label", null, "Practice topic"),
    topic = el("select");
  topic.id = "practiceTopic";
  topic.append(new Option("All topics", "all"));
  for (const t of [...new Set(PRACTICE_QUESTIONS.map((q) => q.topic))])
    topic.add(new Option(t, t));
  topicLabel.append(topic);
  topic.addEventListener("change", () => {
    if (
      $("#practiceAnswer").value.trim() &&
      !confirm("Change question and discard the unsaved answer?")
    ) {
      topic.value = topic.dataset.previous || "all";
      return;
    }
    populateQuestions(topic.value);
    choose();
    topic.dataset.previous = topic.value;
  });
  const qLabel = el("label", null, "Practice question"),
    select = el("select");
  select.id = "practiceQuestion";
  select.addEventListener("change", () => {
    if (
      $("#practiceAnswer").value.trim() &&
      !confirm("Change question and discard the unsaved answer?")
    ) {
      select.value = select.dataset.previous || PRACTICE_QUESTIONS[0].id;
      return;
    }
    choose();
    select.dataset.previous = select.value;
  });
  qLabel.append(select);
  tools.append(topicLabel, qLabel);
  main.append(
    tools,
    el("span", "practice-badge", "STATIC PRACTICE MATERIAL"),
    el("h2", null, ""),
  );
  main.lastChild.id = "practicePrompt";
  const guide = el("details"),
    summary = el("summary", null, "What to consider · static guidance");
  const guideText = el("p", "helper");
  guideText.id = "practiceGuide";
  guide.append(summary, guideText);
  main.append(guide);
  const answerLabel = el(
      "label",
      "practice-answer-label",
      "Your answer in English",
    ),
    answer = el("textarea");
  answer.id = "practiceAnswer";
  answer.rows = 10;
  answer.maxLength = 2000;
  answer.placeholder =
    "Use your own experience. A personal project, course or volunteer activity can be a valid example.";
  answerLabel.append(answer);
  main.append(answerLabel);
  const timer = el("div", "practice-timer-row");
  const output = el("output");
  output.id = "practiceClock";
  output.setAttribute("aria-label", "Practice time in minutes and seconds");
  output.textContent = "00:00";
  const start = button("Start timer", () => {
    if (started) {
      stop();
      return;
    }
    started = performance.now();
    tick = setInterval(clock, 1000);
    start.textContent = "Pause timer";
    start.setAttribute("aria-pressed", "true");
  });
  start.id = "practiceTimer";
  start.setAttribute("aria-pressed", "false");
  timer.append(
    output,
    start,
    button("Reset timer", () => {
      stop();
      seconds = 0;
      clock();
    }),
  );
  main.append(
    timer,
    el(
      "p",
      "helper",
      "The optional timer pauses when you leave this page or hide the browser tab. It is not a scheduled reminder.",
    ),
  );
  const consent = el("label", "check-label"),
    check = el("input");
  check.type = "checkbox";
  check.id = "practiceCloudConsent";
  consent.id = "practiceConsentLabel";
  consent.append(
    check,
    document.createTextNode(
      "I agree to save my answers and checklist to my private Supabase workspace.",
    ),
  );
  main.append(consent);
  const actions = el("div", "button-row");
  const save = button("Save exercise", saveExercise);
  save.id = "savePractice";
  save.classList.add("button-primary");
  actions.append(
    save,
    button("New exercise", newExercise),
    button("Review in AI Coach", reviewWithCoach),
  );
  main.append(actions);
  const feedback = el("p", "helper");
  feedback.id = "practiceStatus";
  feedback.setAttribute("role", "status");
  main.append(
    feedback,
    el(
      "p",
      "helper",
      "No score or AI evaluation is generated here. AI review requires your separate consent, a verified account, an available provider and server-confirmed credits. You will review the prompt in Coach before sending it.",
    ),
  );
  const prep = el("section", "panel section-pad");
  prep.append(el("h2", null, "Preparation checklist"));
  const checks = el("div", "preparation-checks");
  checks.id = "practiceChecks";
  PREPARATION.forEach((text, index) => {
    const l = el("label", "check-label"),
      c = el("input");
    c.type = "checkbox";
    c.value = String(index);
    l.append(c, document.createTextNode(text));
    checks.append(l);
  });
  prep.append(
    checks,
    button("Save preparation checklist", async () => {
      try {
        const checked = [...checks.querySelectorAll("input:checked")].map(
          (x) => x.value,
        );
        if (
          await update((s) => {
            s.checklist = checked;
          })
        )
          status("Preparation checklist saved.");
      } catch (e) {
        status(e.message, true);
      }
    }),
  );
  const history = el("section", "panel section-pad");
  history.append(el("h2", null, "Your practice history"));
  const list = el("div");
  list.id = "practiceHistory";
  history.append(
    list,
    el(
      "p",
      "helper",
      "Up to 30 saved exercises, within the shared workspace-settings storage budget. Nothing is automatically deleted to make room.",
    ),
  );
  rail.append(prep, history);
  layout.append(main, rail);
  root.append(layout);
  populateQuestions("all");
  choose();
  window.addEventListener("launchpad:navigate", (e) => {
    if (e.detail !== "interview") stop();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
}
function populateQuestions(topic) {
  const select = $("#practiceQuestion");
  select.replaceChildren();
  for (const q of PRACTICE_QUESTIONS.filter(
    (q) => topic === "all" || q.topic === topic,
  ))
    select.add(new Option(q.prompt, q.id));
  select.dataset.previous = select.value;
}
async function saveExercise() {
  const ticket = scope;
  $("#savePractice").disabled = true;
  try {
    stop();
    const entry = validatePractice({
      id: exerciseId || crypto.randomUUID(),
      questionId: question().id,
      answer: $("#practiceAnswer").value,
      seconds: Math.round(seconds),
      updatedAt: new Date().toISOString(),
    });
    if (
      await update((s) => {
        const index = s.practices.findIndex((x) => x.id === entry.id);
        if (index < 0) {
          if (s.practices.length >= MAX_PRACTICES)
            throw Error(
              "30 exercise limit reached. Export a backup before removing an exercise.",
            );
          s.practices.push(entry);
        } else s.practices[index] = entry;
      })
    ) {
      exerciseId = entry.id;
      status("Practice exercise saved. No AI evaluation was generated.");
    }
  } catch (e) {
    if (ticket === scope) status(e.message, true);
  } finally {
    $("#savePractice").disabled = false;
  }
}
function reviewWithCoach() {
  if (!$("#practiceAnswer").value.trim()) {
    status("Write an answer before preparing an AI review.", true);
    return;
  }
  if (
    !confirm(
      "Copy this practice question and answer to AI Coach? Nothing is sent until you review the prompt, choose consent options and select Ask coach.",
    )
  )
    return;
  const prompt = `Please help me improve this interview practice answer without inventing qualifications or results.\nQuestion: ${question().prompt}\nMy answer: ${$("#practiceAnswer").value}`;
  context.navigate("coach");
  $("#coachIntent").value = "advice";
  $("#coachPrompt").value = prompt;
  $("#coachPrompt").focus();
}
export function clearInterview55() {
  stop();
  context = null;
  scope = null;
  exerciseId = null;
  seconds = 0;
  historyKey = "";
  checkKey = "";
  if (mounted) {
    $("#practiceAnswer").value = "";
    $("#practiceHistory").replaceChildren();
    $("#practiceCloudConsent").checked = false;
    for (const c of $("#practiceChecks").querySelectorAll("input"))
      c.checked = false;
    clock();
    status("");
  }
}
export function renderInterview55(next) {
  context = next;
  mount();
  if (scope !== next.scope) {
    scope = next.scope;
    exerciseId = null;
    seconds = 0;
    $("#practiceCloudConsent").checked = false;
    choose();
    historyKey = "";
    checkKey = "";
  }
  $("#practiceConsentLabel").hidden = next.mode !== "account";
  try {
    const studio = readStudio(next.data.preferences);
    const key = JSON.stringify(studio.practices);
    if (key !== historyKey) {
      historyKey = key;
      const list = $("#practiceHistory");
      list.replaceChildren();
      if (!studio.practices.length)
        list.append(
          el(
            "p",
            "empty-copy",
            "Your first saved exercise starts your practice history.",
          ),
        );
      for (const entry of [...studio.practices].reverse()) {
        const card = el("article", "practice-history-card");
        const q = PRACTICE_QUESTIONS.find((q) => q.id === entry.questionId);
        card.append(
          el("h3", null, q.prompt),
          el(
            "p",
            "helper",
            `${new Date(entry.updatedAt).toLocaleDateString("en-US")} · ${entry.seconds}s · static practice`,
          ),
          button("Open exercise", () => {
            if (
              $("#practiceAnswer").value.trim() &&
              !confirm("Replace the current draft with this saved exercise?")
            )
              return;
            stop();
            $("#practiceTopic").value = "all";
            populateQuestions("all");
            $("#practiceQuestion").value = entry.questionId;
            choose();
            exerciseId = entry.id;
            seconds = entry.seconds;
            $("#practiceAnswer").value = entry.answer;
            clock();
            status("Saved exercise opened. Edit and save to update it.");
          }),
          button("Delete exercise", async () => {
            if (!confirm("Delete this saved exercise?")) return;
            try {
              if (
                await update((s) => {
                  s.practices = s.practices.filter((x) => x.id !== entry.id);
                })
              ) {
                if (exerciseId === entry.id) {
                  exerciseId = null;
                  $("#practiceAnswer").value = "";
                }
                status("Saved exercise deleted.");
              }
            } catch (e) {
              status(e.message, true);
            }
          }),
        );
        list.append(card);
      }
    }
    const ck = JSON.stringify(studio.checklist);
    if (ck !== checkKey) {
      checkKey = ck;
      for (const c of $("#practiceChecks").querySelectorAll("input"))
        c.checked = studio.checklist.includes(c.value);
    }
  } catch (e) {
    status(e.message, true);
  }
}
