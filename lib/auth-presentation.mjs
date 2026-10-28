// Presentation only: server-confirmed Auth and the owned workspace drive setup facts.
export function mountAuthPresentation() {
  const $ = (s) => document.querySelector(s);
  const node = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const steps = node("ol", "registration-steps");
  steps.id = "registrationSteps";
  steps.setAttribute("aria-label", "Account setup progress");
  for (const [i, text] of [
    "Account",
    "Confirm email",
    "Personalize",
    "Ready",
  ].entries()) {
    const li = node("li");
    li.append(node("span", "step-number", i + 1), node("span", null, text));
    steps.append(li);
  }
  $("#authModes").before(steps);
  const subtitle = node("p", "auth-screen-subtitle");
  subtitle.id = "authSubtitle";
  const title = $("#authTitle"),
    titleGroup = node("div", "auth-title-group");
  title.before(titleGroup);
  titleGroup.append(title, subtitle);
  const benefits = node("ul", "auth-benefits");
  for (const text of [
    "Keep your opportunities in one place",
    "Use a separate, verified account workspace",
    "Stay in control of your career data",
  ])
    benefits.append(node("li", null, text));
  $(".auth-brand-story").append(benefits);
  const accountSetup = node("section", "account-setup-panel");
  accountSetup.id = "accountSetupPanel";
  accountSetup.hidden = true;
  accountSetup.append(
    node("p", "eyebrow", "YOUR NEXT STEP"),
    node("h3", null, "Make this workspace yours."),
  );
  const setupStatus = node("p", "helper");
  setupStatus.id = "accountSetupStatus";
  setupStatus.setAttribute("role", "status");
  const actions = node("div", "account-setup-actions");
  for (const [label, view, field] of [
    ["Set up my profile", "settings", "profileName"],
    ["Define my career goal", "roadmap", "goalTitle"],
    ["Go to dashboard", "dashboard", ""],
  ]) {
    const b = node("button", "button button-outline", label);
    b.type = "button";
    b.addEventListener("click", () => {
      $("#authDialog").close();
      window.launchpadData?.navigate(view);
      const target = $("#" + field);
      if (target && !target.hidden) target.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "auto" });
    });
    actions.append(b);
  }
  accountSetup.append(
    setupStatus,
    actions,
    node(
      "p",
      "helper",
      "Profile and goals are optional. Use the existing forms to save them to your active account; guest records are never imported automatically. Cloud roadmap editing follows your plan limits.",
    ),
  );
  $("#cloudActions").after(accountSetup);
  const guest = node("button", "auth-guest-link", "Continue as a guest");
  guest.id = "authContinueGuest";
  guest.type = "button";
  guest.addEventListener("click", () => $("#authDialog").close());
  $("#authForm").append(guest);
  for (const input of [
    $("#authEmail"),
    $("#authPassword"),
    $("#authConfirmPassword"),
    $("#signupAge"),
    $("#signupTerms"),
  ]) {
    input.setAttribute("aria-errormessage", "authStatus");
    input.addEventListener("input", () =>
      input.removeAttribute("aria-invalid"),
    );
  }
  let last = {},
    progress = null;
  const render = (state) => {
    last = state;
    const { mode, connected, signedIn, userId } = state;
    $("#authForm").dataset.mode = signedIn ? "account" : mode;
    $("#authDialog").dataset.mode = signedIn ? "account" : mode;
    subtitle.textContent = !connected
      ? "Your local organizer remains available."
      : signedIn
        ? "Manage your verified account and choose your next step."
        : {
            signin: "Welcome back. Continue where you left off.",
            signup: "Start your next chapter with a verified email account.",
            verify: "One more step: confirm the link in your email.",
            forgot: "We’ll help you request a secure recovery link.",
            reset: "Choose a new password for your account.",
          }[mode];
    steps.hidden =
      !connected || (!signedIn && !["signup", "verify"].includes(mode));
    const own =
      progress?.mode === "account" &&
      progress.ownerId === userId &&
      !progress.busy;
    const complete = signedIn && own && progress.profile && progress.goals;
    const current = signedIn ? (complete ? 3 : 2) : mode === "verify" ? 1 : 0;
    for (const [i, step] of [...steps.children].entries()) {
      step.dataset.state =
        i < current ? "complete" : i === current ? "current" : "pending";
      if (i === current) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    }
    accountSetup.hidden = !signedIn;
    setupStatus.textContent = !own
      ? "Open and load your account workspace to review profile and goal progress. Guest progress is not used here."
      : complete
        ? "Your account profile and a career goal are saved. Keep building at your own pace."
        : `Email confirmed. ${progress.profile ? "Profile saved." : "Choose a profile name when ready."} ${progress.goals ? "Career goal saved." : "Add a career goal when ready."}`;
    actions.querySelectorAll("button").forEach((b) => (b.disabled = !own));
    guest.hidden = signedIn || mode === "reset";
  };
  window.addEventListener("launchpad:setup-progress", (event) => {
    progress = event.detail;
    render(last);
  });
  window.addEventListener("launchpad:auth", () => {
    progress = null;
    accountSetup.hidden = true;
  });
  return { render };
}
