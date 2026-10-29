/* AppSpace — funcionalidades opcionais; o HTML continua navegável sem JavaScript. */
(() => {
  "use strict";

  const storageKey = "appspace.theme";
  const root = document.documentElement;
  const toggles = document.querySelectorAll("[data-theme-toggle]");

  function readTheme() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark") return saved;
    } catch (_) { /* Alguns navegadores restringem storage em file:// */ }
    return "dark";
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    toggles.forEach((button) => {
      const light = theme === "light";
      button.setAttribute("aria-label", light ? "Ativar tema escuro" : "Ativar tema claro");
      button.setAttribute("title", light ? "Ativar tema escuro" : "Ativar tema claro");
      button.setAttribute("aria-pressed", String(light));
    });
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = theme === "light" ? "#f4f6fb" : "#0b101b";
  }

  applyTheme(readTheme());
  toggles.forEach((button) => button.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(storageKey, next); } catch (_) { /* Tema continua funcionando nesta sessão. */ }
  }));

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const search = document.getElementById("app-search");
  const cards = [...document.querySelectorAll(".app-card")];
  const emptyState = document.getElementById("search-empty");

  if (search && emptyState) {
    const total = String(cards.length).padStart(2, "0");
    document.querySelectorAll(".section-count, .nav-count").forEach((element) => {
      element.textContent = total;
    });

    const normalize = (value) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    function filterApps() {
      const term = normalize(search.value);
      let visible = 0;
      for (const card of cards) {
        const matches = normalize(card.dataset.search || card.textContent).includes(term);
        card.hidden = !matches;
        if (matches) visible += 1;
      }
      emptyState.hidden = visible !== 0;
    }

    search.addEventListener("input", filterApps);
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isEditing = target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditing) {
        event.preventDefault();
        search.focus();
      }
      if (event.key === "Escape" && document.activeElement === search) {
        search.value = "";
        filterApps();
        search.blur();
      }
    });
  }
})();
