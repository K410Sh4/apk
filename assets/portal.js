/* AppSpace v0.3 — preferências locais + áudio sintetizado, sem recursos externos. */
(() => {
  "use strict";

  const KEY = "appspace.preferences.v1";
  const LEGACY_THEME_KEY = "appspace.theme";
  const DEFAULTS = Object.freeze({
    theme: "dark", accent: "violet", density: "comfortable",
    libraryView: "cards", librarySort: "default", mobileNavStyle: "classic",
    effects: "normal", sound: false, volume: 30
  });
  const OPTIONS = {
    theme: ["dark", "light"],
    accent: ["violet", "blue", "mint", "pink"],
    density: ["comfortable", "compact"],
    libraryView: ["cards", "launcher"],
    librarySort: ["default", "az", "za"],
    mobileNavStyle: ["classic", "minimal"],
    effects: ["normal", "reduced", "off"]
  };
  const root = document.documentElement;
  const toggles = document.querySelectorAll("[data-theme-toggle]");
  let audioContext = null;
  const mobileViewport = window.matchMedia("(max-width: 850px)");

  // O menu Clássico permanece intocado; o simplificado é gerado uma única vez
  // e aparece somente no mobile quando a pessoa escolhe "Minimalista".
  function syncMobileNavigation() {
    if (document.querySelector(".minimal-bottom-nav")) return;
    const original = document.querySelector(".mobile-nav");
    const brand = document.querySelector("a.mobile-brand");
    if (!original || !brand) return;
    const home = new URL(brand.getAttribute("href"), location.href);
    const settings = new URL("configuracoes.html", home);
    const items = [
      { label: "Início", icon: "⌂", url: home.href, current: document.body.classList.contains("page-home") },
      { label: "Apps", icon: "▦", url: home.href + "#launcher", current: !document.body.classList.contains("page-home") && !document.body.classList.contains("page-settings") },
      { label: "Ajustes", icon: "⚙", url: settings.href, current: document.body.classList.contains("page-settings") }
    ];
    const bar = document.createElement("nav");
    bar.className = "minimal-bottom-nav";
    bar.setAttribute("aria-label", "Navegação móvel minimalista");
    for (const item of items) {
      const link = document.createElement("a");
      link.href = item.url;
      if (item.current) link.setAttribute("aria-current", "page");
      const glyph = document.createElement("span");
      glyph.className = "minimal-nav-glyph";
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = item.icon;
      const name = document.createElement("span");
      name.textContent = item.label;
      link.append(glyph, name);
      bar.append(link);
    }
    original.insertAdjacentElement("afterend", bar);
  }


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
    root.dataset.libraryView = prefs.libraryView;
    root.dataset.librarySort = prefs.librarySort;
    root.dataset.mobileNavStyle = prefs.mobileNavStyle;
    syncMobileNavigation();
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
    if (key === "libraryView" || key === "librarySort" || key === "mobileNavStyle") refreshLibraryView();
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
      } else if (key === "accent" || key === "theme" || key === "density" || key === "effects" || key === "libraryView" || key === "librarySort" || key === "mobileNavStyle") {
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
    refreshLibraryView();
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
  const appCards = [...document.querySelectorAll(".app-card")];
  const folderCards = [...document.querySelectorAll(".folder-card")];
  const emptyState = document.getElementById("search-empty");

  // Uma única fonte de verdade: os próprios links das pastas e aplicativos.
  // A grade é montada a partir desses links e nunca duplica cards manualmente.
  const launcher = document.getElementById("launcher");
  const launcherGrid = document.getElementById("launcher-grid");
  const launcherSearch = document.getElementById("launcher-search");
  const launcherEmpty = document.getElementById("launcher-empty");
  const launcherOrder = document.getElementById("launcher-order");
  const normalize = (value) => String(value).toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const sortCollator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

  [...folderCards, ...appCards].forEach((card, index) => {
    card.dataset.originalIndex = String(index);
  });

  function getTitle(card) {
    return card.querySelector("h3")?.textContent?.trim() || card.getAttribute("aria-label") || "";
  }

  function compareCards(a, b) {
    if (prefs.librarySort === "az" || prefs.librarySort === "za") {
      const result = sortCollator.compare(getTitle(a), getTitle(b));
      return (prefs.librarySort === "za" ? -result : result) ||
        Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex);
    }
    return Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex);
  }

  function arrangeCards(cards) {
    if (!cards.length) return;
    const parent = cards[0].parentElement;
    if (!parent) return;
    [...cards].sort(compareCards).forEach((card) => parent.appendChild(card));
  }

  function createLauncherTile(card, isFolder) {
    const tile = document.createElement("a");
    tile.className = "launcher-tile " + (isFolder ? "launcher-tile--folder" : "launcher-tile--app");
    if (card.classList.contains("folder-card--stock")) tile.classList.add("launcher-tile--stock");
    if (card.classList.contains("folder-card--video")) tile.classList.add("launcher-tile--video");
    tile.href = card.getAttribute("href") || "./index.html";
    tile.dataset.search = card.dataset.search || getTitle(card);
    const icon = document.createElement("span");
    icon.className = "launcher-tile-icon";
    icon.setAttribute("aria-hidden", "true");
    const folderGlyph = isFolder ? card.querySelector(".folder-big-icon svg") : null;
    if (folderGlyph) icon.appendChild(folderGlyph.cloneNode(true));
    else icon.textContent = "✦";
    const name = document.createElement("span");
    name.className = "launcher-tile-name";
    name.textContent = getTitle(card);
    const type = document.createElement("small");
    type.className = "launcher-tile-type";
    type.textContent = isFolder ? "Pasta" : "Aplicativo";
    tile.append(icon, name, type);
    tile.setAttribute("aria-label", "Abrir " + (isFolder ? "pasta " : "aplicativo ") + getTitle(card));
    return tile;
  }

  function filterLauncher() {
    if (!launcherGrid || !launcherEmpty) return;
    const term = normalize(launcherSearch?.value || "");
    let visible = 0;
    launcherGrid.querySelectorAll(".launcher-tile").forEach((tile) => {
      const matches = normalize(tile.dataset.search || tile.textContent).includes(term);
      tile.hidden = !matches;
      if (matches) visible++;
    });
    launcherEmpty.hidden = visible > 0;
  }

  function refreshLibraryView() {
    // O modo minimalista força a gaveta só em telas móveis;
    // a preferência de cards/grade no desktop permanece independente.
    const mobileMinimal = prefs.mobileNavStyle === "minimal" && mobileViewport.matches;
    const active = prefs.libraryView === "launcher" || mobileMinimal;
    if (launcher) launcher.hidden = !active;
    if (launcherOrder) launcherOrder.textContent =
      prefs.librarySort === "az" ? "A–Z" : prefs.librarySort === "za" ? "Z–A" : "Original";
    arrangeCards(folderCards);
    arrangeCards(appCards);
    if (launcherGrid) {
      launcherGrid.replaceChildren();
      // A grade funciona como gaveta única; a ordem original coloca pastas antes de apps.
      [...folderCards, ...appCards].sort(compareCards).forEach((card) => {
        launcherGrid.appendChild(createLauncherTile(card, folderCards.includes(card)));
      });
      filterLauncher();
    }
  }

  if (search && emptyState) {
    const appTotal = String(appCards.length).padStart(2, "0");
    const folderTotal = String(folderCards.length).padStart(2, "0");
    document.querySelectorAll(".section-count:not(.folder-count), .nav-count").forEach((element) => {
      element.textContent = appTotal;
    });
    document.querySelectorAll(".folder-count, .folder-nav-count").forEach((element) => {
      element.textContent = folderTotal;
    });

    const foldersSection = document.getElementById("pastas");
    const librarySection = document.querySelector(".library");
    // A busca existente e a busca do launcher usam a mesma normalização.


    function filterApps() {
      const term = normalize(search.value);
      const countMatches = (cards) => {
        let visible = 0;
        for (const card of cards) {
          const matches = normalize(card.dataset.search || card.textContent).includes(term);
          card.hidden = !matches;
          if (matches) visible += 1;
        }
        return visible;
      };
      const matchingApps = countMatches(appCards);
      const matchingFolders = countMatches(folderCards);
      if (foldersSection) foldersSection.hidden = Boolean(term) && matchingFolders === 0;
      if (librarySection) librarySection.hidden = Boolean(term) && matchingApps === 0 && matchingFolders > 0;
      emptyState.hidden = matchingApps + matchingFolders !== 0;
    }

    search.addEventListener("input", filterApps);
    if (launcherSearch) launcherSearch.addEventListener("input", filterLauncher);
    refreshLibraryView();
    mobileViewport.addEventListener("change", refreshLibraryView);
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isEditing = target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditing) {
        event.preventDefault();
        (prefs.libraryView === "launcher" && launcherSearch ? launcherSearch : search).focus();
      }
      if (event.key === "Escape" && (document.activeElement === search || document.activeElement === launcherSearch)) {
        const activeSearch = document.activeElement;
        activeSearch.value = "";
        if (activeSearch === launcherSearch) filterLauncher();
        else filterApps();
        activeSearch.blur();
      }
    });
  }
})();
