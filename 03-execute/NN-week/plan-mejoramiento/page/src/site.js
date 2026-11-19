// Mejora progresiva: el contenido y los enlaces funcionan sin JavaScript.
const toggle = document.querySelector(".menu-toggle");
const navigation = document.getElementById("navigation");
if (toggle && navigation) {
  document.documentElement.classList.add("js");
  toggle.hidden = false;
  const narrow = window.matchMedia("(max-width: 900px)");
  function closeMenu(returnFocus = false) {
    toggle.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    navigation.classList.toggle("is-open", open);
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      toggle.getAttribute("aria-expanded") === "true"
    )
      closeMenu(true);
  });
  document.addEventListener("click", (event) => {
    if (
      event.target instanceof Node &&
      !navigation.contains(event.target) &&
      !toggle.contains(event.target)
    )
      closeMenu();
  });
  narrow.addEventListener("change", () => {
    const focusedInside = navigation.contains(document.activeElement);
    closeMenu(narrow.matches && focusedInside);
  });
  // Tab fuera del menú lo cierra sin dejar enlaces invisibles en el orden de foco.
  document.addEventListener("focusin", (event) => {
    if (
      event.target instanceof Node &&
      !navigation.contains(event.target) &&
      !toggle.contains(event.target)
    )
      closeMenu();
  });
}
for (const anchor of document.querySelectorAll('a[href^="#"]')) {
  anchor.addEventListener("click", () => {
    const target = document.getElementById(
      anchor.getAttribute("href").slice(1),
    );
    if (!target) return;
    const wasOpen = toggle?.getAttribute("aria-expanded") === "true";
    if (wasOpen) {
      toggle.setAttribute("aria-expanded", "false");
      navigation?.classList.remove("is-open");
    }
    // El destino recibe foco después de la navegación nativa por fragmento.
    requestAnimationFrame(() => {
      if (!target.hasAttribute("tabindex"))
        target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });
}
