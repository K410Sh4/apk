/* AppSpace v0.3 — preferências locais + áudio sintetizado, sem recursos externos. */
(() => {
  "use strict";

  const KEY = "appspace.preferences.v1";
  const LEGACY_THEME_KEY = "appspace.theme";
  const DEFAULTS = Object.freeze({
    theme: "dark", accent: "violet", density: "comfortable",
    effects: "normal", sound: false, volume: 30
  });
  const OPTIONS = {
    theme: ["dark", "light"],
    accent: ["violet", "blue", "mint", "pink"],
    density: ["comfortable", "compact"],
    effects: ["normal", "reduced", "off"]
  };
  const root = document.documentElement;
  const toggles = document.querySelectorAll("[data-theme-toggle]");
  let audioContext = null;

  function safeGet(key) {
    try { return localStorage.getItem(key); }
    catch (_) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (_) { return false; }
  }

  function validate(input) {
    const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const value = { ...DEFAULTS };
    for (const key of Object.keys(OPTIONS)) {
      if (OPTIONS[key].includes(src[key])) value[key] = src[key];
    }
    if (typeof src.sound === "boolean") value.sound = src.sound;
    if (typeof src.volume === "number" && Number.isFinite(src.volume)) {
      value.volume = Math.max(0, Math.min(100, Math.round(src.volume / 5) * 5));
    }
    return value;
  }

  function loadPreferences() {
    let persisted;
    try { persisted = JSON.parse(safeGet(KEY) || "null"); }
    catch (_) { persisted = null; }
    const value = validate(persisted);
    if (!persisted) {
      const legacyTheme = safeGet(LEGACY_THEME_KEY);
      if (OPTIONS.theme.includes(legacyTheme)) value.theme = legacyTheme;
    }
    return value;
  }

  let prefs = loadPreferences();

  function updateStatus(message) {
    const status = document.getElementById("settings-status");
    if (status) status.textContent = message;
  }

  function applyPreferences() {
    root.dataset.theme = prefs.theme;
    root.dataset.accent = prefs.accent;
    root.dataset.density = prefs.density;
    root.dataset.effects = prefs.effects;
    const light = prefs.theme === "light";
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = light ? "#f4f6fb" : "#0b101b";
    toggles.forEach((button) => {
      button.setAttribute("aria-label", light ? "Ativar tema escuro" : "Ativar tema claro");
      button.setAttribute("title", light ? "Ativar tema escuro" : "Ativar tema claro");
      button.setAttribute("aria-pressed", String(light));
    });
    document.querySelectorAll("[data-setting]").forEach((control) => {
      const key = control.dataset.setting;
      if (control.type === "radio") control.checked = prefs[key] === control.value;
      if (control.type === "checkbox") control.checked = Boolean(prefs[key]);
      if (control.type === "range") control.value = String(prefs[key]);
    });
    const output = document.getElementById("volume-value");
    if (output) output.textContent = prefs.volume + "%";
    const volumeGroup = document.getElementById("volume-group");
    if (volumeGroup) volumeGroup.classList.toggle("is-disabled", !prefs.sound);
    const volumeInput = document.getElementById("sound-volume");
    if (volumeInput) volumeInput.disabled = !prefs.sound;
    const preview = document.getElementById("sound-preview");
    if (preview) preview.disabled = !prefs.sound || prefs.volume === 0;
  }

  function setPreference(key, value, { feedback = true } = {}) {
    prefs = validate({ ...prefs, [key]: value });
    applyPreferences();
    const stored = safeSet(KEY, JSON.stringify(prefs));
    if (feedback) updateStatus(stored ? "Alterações salvas neste dispositivo." :
      "Preferências aplicadas, mas o navegador bloqueou o armazenamento local.");
  }

  // Web Audio é acionado apenas após interação humana, por padrão desligado.
  function playSound(kind = "tap") {
    if (!prefs.sound || prefs.volume === 0) return false;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      if (!audioContext || audioContext.state === "closed") audioContext = new Ctx();
      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
      }
      const now = audioContext.currentTime;
      const notes = kind === "confirm" ? [520, 740] : [630];
      const gainValue = (prefs.volume / 100) * 0.075;
      notes.forEach((frequency, index) => {
        const offset = index * 0.085;
        const duration = kind === "confirm" ? 0.13 : 0.075;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = kind === "confirm" ? "sine" : "triangle";
        osc.frequency.setValueAtTime(frequency, now + offset);
        osc.frequency.exponentialRampToValueAtTime(frequency * 1.04, now + offset + duration);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now + offset);
        osc.stop(now + offset + duration + 0.01);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  applyPreferences();

  toggles.forEach((button) => button.addEventListener("click", () => {
    setPreference("theme", prefs.theme === "dark" ? "light" : "dark");
  }));

  document.querySelectorAll("[data-setting]").forEach((control) => {
    const key = control.dataset.setting;
    const eventType = control.type === "range" ? "input" : "change";
    control.addEventListener(eventType, () => {
      const next = control.type === "checkbox" ? control.checked :
        control.type === "range" ? Number(control.value) : control.value;
      setPreference(key, next);
      if (key === "sound" && next === true) {
        if (!playSound("confirm")) updateStatus("Sons ativados. Se não ouvir, verifique o volume do dispositivo.");
      } else if (key === "accent" || key === "theme" || key === "density" || key === "effects") {
        playSound("tap");
      }
    });
  });

  const preview = document.getElementById("sound-preview");
  if (preview) preview.addEventListener("click", () => {
    if (!playSound("confirm")) updateStatus("Som indisponível neste navegador ou no volume atual.");
  });

  const resetButton = document.getElementById("reset-settings");
  if (resetButton) resetButton.addEventListener("click", () => {
    prefs = { ...DEFAULTS };
    applyPreferences();
    const stored = safeSet(KEY, JSON.stringify(prefs));
    // Elimina a migração do tema antigo em sessões futuras, sem apagar outras informações.
    safeSet(LEGACY_THEME_KEY, "dark");
    updateStatus(stored ? "Configurações originais restauradas." : "Padrões aplicados; o armazenamento está bloqueado.");
  });

  // Som para links e botões comuns: nunca para cada tecla ou movimento de cursor.
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionable = target.closest("a, button");
    if (!actionable || actionable.matches(":disabled, [data-no-click-sound]")) return;
    playSound("tap");
  }, true);

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
