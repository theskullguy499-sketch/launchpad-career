// Password visibility and requirements only; never retains or persists passwords.
export function mountAuthControls() {
  const password = document.querySelector("#authPassword"),
    confirm = document.querySelector("#authConfirmPassword");
  const toolbar = document.createElement("div");
  toolbar.className = "password-tools";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.id = "togglePassword";
  toggle.className = "password-toggle";
  toggle.textContent = "Show password";
  toggle.setAttribute("aria-controls", "authPassword");
  toggle.setAttribute("aria-pressed", "false");
  toolbar.append(toggle);
  document.querySelector("#authPasswordLabel").after(toolbar);
  const requirements = document.createElement("ul");
  requirements.id = "passwordRequirements";
  requirements.className = "password-requirements";
  const length = document.createElement("li"),
    match = document.createElement("li");
  length.textContent = "12 or more characters";
  match.textContent = "Both passwords match";
  requirements.append(length, match);
  document.querySelector("#passwordHint").after(requirements);
  password.setAttribute(
    "aria-describedby",
    "passwordHint passwordRequirements",
  );
  confirm.setAttribute("aria-describedby", "passwordRequirements");
  const update = () => {
    const longEnough = password.value.length >= 12,
      matched = !!confirm.value && password.value === confirm.value;
    length.dataset.met = String(longEnough);
    length.textContent = (longEnough ? "✓ " : "○ ") + "12 or more characters";
    match.dataset.met = String(matched);
    match.textContent = (matched ? "✓ " : "○ ") + "Both passwords match";
  };
  toggle.addEventListener("click", () => {
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    toggle.textContent = show ? "Hide password" : "Show password";
    toggle.setAttribute("aria-pressed", String(show));
  });
  password.addEventListener("input", update);
  confirm.addEventListener("input", update);
  return {
    refresh(mode, busy) {
      toolbar.hidden =
        password.disabled ||
        document.querySelector("#authPasswordLabel").hidden;
      toggle.disabled = busy;
      requirements.hidden =
        !["signup", "reset"].includes(mode) || password.disabled;
      update();
    },
    reset() {
      password.type = "password";
      toggle.textContent = "Show password";
      toggle.setAttribute("aria-pressed", "false");
      update();
    },
  };
}
