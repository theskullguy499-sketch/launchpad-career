// Progressive enhancement: the desktop sidebar remains the single navigation tree.
const sidebar = document.querySelector("#mainNavigation");
const toggle = document.querySelector("#menuToggle");
const close = document.querySelector("#closeNavigation");
const header = document.querySelector("#mobileHeader");
const main = document.querySelector("#mainContent");
const skip = document.querySelector(".skip-link");
const media = matchMedia("(max-width: 768px)");
let open = false;
let previousInert = [];
let pendingFocus = null;
const focusables = () =>
  [...sidebar.querySelectorAll("a[href], button:not(:disabled)")].filter(
    (element) => element.getClientRects().length,
  );
function setOpen(next, destination = "toggle") {
  open = media.matches && next;
  document.body.classList.toggle("navigation-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  if (open) {
    previousInert = [main, header, skip].map((element) => [
      element,
      element.inert,
    ]);
    for (const [element] of previousInert) element.inert = true;
    sidebar.inert = false;
    sidebar.setAttribute("role", "dialog");
    sidebar.setAttribute("aria-modal", "true");
    // Focus after the CSS transition (or immediately with reduced motion).
    // Some engines reject focus while the drawer is still outside its clip.
    pendingFocus = close;
    Promise.allSettled(
      sidebar.getAnimations().map((animation) => animation.finished),
    ).then(() => {
      if (open && !sidebar.contains(document.activeElement))
        pendingFocus?.focus({ preventScroll: true });
    });
  } else {
    for (const [element, value] of previousInert) element.inert = value;
    previousInert = [];
    sidebar.removeAttribute("role");
    sidebar.removeAttribute("aria-modal");
    sidebar.inert = media.matches;
    if (destination === "main") {
      main.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "auto" });
    } else if (media.matches) toggle.focus({ preventScroll: true });
    else
      sidebar
        .querySelector('[aria-current="page"]')
        ?.focus({ preventScroll: true });
  }
}
toggle.addEventListener("click", () => setOpen(!open));
close.addEventListener("click", () => setOpen(false));
// During a rapid reopen, an inert background may retarget the first pointer
// event to body before the fading backdrop is hit-testable. Dismiss from the
// capture phase too, so a real outside touch never depends on an animation frame.
document.addEventListener(
  "pointerdown",
  (event) => {
    if (open && !sidebar.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  },
  true,
);
document
  .querySelector("#navigationBackdrop")
  .addEventListener("click", () => setOpen(false));
sidebar.addEventListener("click", (event) => {
  if (open && event.target.closest(".nav-item, a[href^='#']")) setOpen(false, "main");
});
window.addEventListener("launchpad:navigate", () => {
  if (open) setOpen(false, "main");
});
window.addEventListener("launchpad:auth", () => {
  if (open) setOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (!open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
  } else if (event.key === "Tab") {
    const items = focusables();
    const first = items[0],
      last = items.at(-1);
    if (!first) return;
    if (!sidebar.contains(document.activeElement)) {
      event.preventDefault();
      pendingFocus = event.shiftKey ? last : first;
      pendingFocus.focus({ preventScroll: true });
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
media.addEventListener("change", () => {
  const needsFocus =
    open ||
    sidebar.contains(document.activeElement) ||
    header.contains(document.activeElement);
  if (needsFocus) setOpen(false);
  else sidebar.inert = media.matches;
});
skip.addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
});
sidebar.inert = media.matches;
