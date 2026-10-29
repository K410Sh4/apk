/* AppSpace OTA v1.0 - atualização do conteúdo web via Capacitor Updater.
 * Nunca substitui a APK nem executa em navegadores/Electron.
 * O bundle embutido permanece disponível offline e pode ser restaurado.
 */
(() => {
  "use strict";
  const NATIVE_VERSION = "0.7.0";
  const MANIFEST_URL = "https://raw.githubusercontent.com/K410Sh4/apk/main/ota/latest.json";
  const PREF_KEY = "appspace.ota.auto";
  const VERSION = /^\d+\.\d+\.\d+$/;
  const ZIP_ORIGIN = /^https:\/\/github\.com\/K410Sh4\/apk\/releases\/download\/appspace-web-v\d+\.\d+\.\d+\/appspace-web-v\d+\.\d+\.\d+\.zip$/;
  const capacitor = window.Capacitor;
  const native = capacitor && typeof capacitor.isNativePlatform === "function" && capacitor.isNativePlatform();
  let updater = null;
  if (native) {
    try {
      updater = capacitor.Plugins?.CapacitorUpdater || capacitor.registerPlugin?.("CapacitorUpdater") || null;
    } catch (_) { /* O portal funciona sem o plugin */ }
  }
  const supported = Boolean(native && updater && typeof updater.notifyAppReady === "function");
  // Prioridade máxima: o plugin usa esta chamada como verificação de boot / rollback.
  if (supported) updater.notifyAppReady().catch((e) => console.warn("[AppSpace OTA] AppReady:", e));

  function readAuto() {
    try { return localStorage.getItem(PREF_KEY) !== "off"; } catch (_) { return true; }
  }
  function saveAuto(value) {
    try { localStorage.setItem(PREF_KEY, value ? "on" : "off"); return true; }
    catch (_) { return false; }
  }
  function compare(a, b) {
    if (!VERSION.test(a) || !VERSION.test(b)) throw Error("Versão inválida.");
    const av = a.split(".").map(Number), bv = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) { if (av[i] !== bv[i]) return Math.sign(av[i] - bv[i]); }
    return 0;
  }
  function validateManifest(data) {
    if (!data || data.schema !== 1 || !VERSION.test(data.version || "") ||
        !VERSION.test(data.minNative || "") || typeof data.url !== "string" ||
        !ZIP_ORIGIN.test(data.url) || !/^[a-f0-9]{64}$/.test(data.sha256 || "")) {
      throw Error("Metadados de atualização inválidos.");
    }
    if (data.url.includes("/appspace-web-v" + data.version + "/") === false ||
        data.url.endsWith("/appspace-web-v" + data.version + ".zip") === false) {
      throw Error("O arquivo não corresponde à versão anunciada.");
    }
    return data;
  }
  let currentVersion = NATIVE_VERSION;
  let candidate = null;
  let working = false;
  let staged = false;
  let latestStatus = "Sem verificação recente.";

  function show(message, state = "neutral") {
    latestStatus = message;
    const el = document.getElementById("ota-status");
    if (el) { el.textContent = message; el.dataset.state = state; }
  }
  function syncUI() {
    const current = document.getElementById("ota-current");
    if (current) current.textContent = currentVersion;
    const available = document.getElementById("ota-available");
    if (available) available.textContent = candidate?.version || "—";
    const auto = document.getElementById("ota-auto");
    if (auto) { auto.checked = readAuto(); auto.disabled = !supported; }
    const check = document.getElementById("ota-check");
    if (check) check.disabled = !supported || working;
    const install = document.getElementById("ota-install");
    if (install) { install.hidden = !candidate || staged; install.disabled = !supported || working; }
    const apply = document.getElementById("ota-apply");
    if (apply) { apply.hidden = !staged; apply.disabled = !supported || working; }
    const reset = document.getElementById("ota-reset");
    if (reset) reset.disabled = !supported || working;
    const state = document.getElementById("ota-status");
    if (state) state.textContent = latestStatus;
  }
  async function readCurrent() {
    if (!supported) return NATIVE_VERSION;
    try {
      const response = await updater.current();
      const installed = response?.bundle?.version;
      currentVersion = installed && VERSION.test(installed) ? installed : NATIVE_VERSION;
      if (response?.bundle?.id === "builtin") currentVersion = NATIVE_VERSION;
    } catch (error) {
      console.warn("[AppSpace OTA] Não foi possível ler versão instalada:", error);
    }
    syncUI();
    return currentVersion;
  }
  async function checkUpdates({ silent = false } = {}) {
    if (!supported) {
      show("Atualizações OTA disponíveis somente no APK Android.", "neutral");
      syncUI();
      return null;
    }
    if (working) return null;
    working = true; syncUI();
    show("Consultando atualizações…");
    try {
      await readCurrent();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 11000);
      let response;
      try {
        response = await fetch(MANIFEST_URL + "?t=" + Date.now(), {
          cache: "no-store", signal: controller.signal, redirect: "follow"
        });
      } finally { clearTimeout(timeout); }
      if (!response.ok) throw Error("Servidor indisponível (HTTP " + response.status + ").");
      const raw = await response.json();
      if (raw.schema !== 1 || !VERSION.test(raw.version || "")) throw Error("Manifesto inválido.");
      if (compare(raw.version, currentVersion) <= 0) {
        candidate = null;
        show("Você está usando a versão mais recente do conteúdo.", "success");
        return null;
      }
      const update = validateManifest(raw);
      if (compare(NATIVE_VERSION, update.minNative) < 0) {
        candidate = null;
        show("Esta atualização exige um APK mais novo.", "warning");
        return null;
      }
      candidate = update;
      show("Nova versão " + update.version + " encontrada. " + (update.notes || ""), "success");
      return update;
    } catch (e) {
      if (!silent) console.warn("[AppSpace OTA] Verificação:", e);
      show("Sem conexão ou atualização indisponível. O portal offline continua funcionando.", "warning");
      return null;
    } finally { working = false; syncUI(); }
  }
  async function installUpdate({ background = false } = {}) {
    if (!supported || !candidate || working) return;
    working = true; syncUI();
    show("Baixando e validando versão " + candidate.version + "…");
    try {
      const info = await updater.download({
        url: candidate.url, version: candidate.version, checksum: candidate.sha256
      });
      if (!info || typeof info.id !== "string" || !info.id) throw Error("Pacote inválido.");
      if (background) {
        await updater.next({ id: info.id });
        staged = true;
        show("Atualização baixada. Feche e reabra o aplicativo para ativá-la.", "success");
      } else {
        show("Instalando nova versão. O aplicativo será reiniciado…", "success");
        await updater.set({ id: info.id });
      }
    } catch (e) {
      console.error("[AppSpace OTA] Falha na instalação:", e);
      show("Não foi possível instalar a atualização. A versão anterior continua disponível.", "warning");
    } finally { working = false; syncUI(); }
  }
  async function rollback() {
    if (!supported || working) return;
    working = true; syncUI();
    show("Restaurando conteúdo original do APK…");
    try {
      await updater.reset({ toLastSuccessful: true });
      show("Versão anterior restaurada. Reiniciando…", "success");
      await updater.reload();
    } catch (e) {
      show("Não foi possível restaurar automaticamente.", "warning");
      console.warn("[AppSpace OTA] rollback:", e);
    } finally { working = false; syncUI(); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!supported) show("Versão web / desktop: atualizações OTA disponíveis no APK Android.");
    syncUI();
    document.getElementById("ota-check")?.addEventListener("click", () => { void checkUpdates(); });
    document.getElementById("ota-install")?.addEventListener("click", () => { void installUpdate(); });
    document.getElementById("ota-apply")?.addEventListener("click", () => {
      if (supported) { show("Aplicando atualização…"); updater.reload().catch(() => show("Reabra o aplicativo para aplicar.")); }
    });
    document.getElementById("ota-reset")?.addEventListener("click", () => { void rollback(); });
    document.getElementById("ota-auto")?.addEventListener("change", (event) => {
      const enabled = event.target.checked;
      saveAuto(enabled);
      show(enabled ? "Verificação automática ativada." : "Verificação automática desativada.");
      if (enabled) { void checkUpdates().then((found) => { if (found) return installUpdate({ background:true }); }); }
    });
    if (supported) {
      void readCurrent().then(async () => {
        if (readAuto()) {
          const found = await checkUpdates({ silent:true });
          if (found) await installUpdate({ background:true });
        }
      });
    }
  });
  window.AppSpaceOTA = Object.freeze({ checkUpdates, readCurrent, compare });
})();
