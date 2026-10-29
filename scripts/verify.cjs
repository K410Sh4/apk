"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const text = (name) => fs.readFileSync(path.join(root, name), "utf8");

const home = text("index.html");
const detail = text("apps/primeiro-app/index.html");
const stock = text("apps/estoque/index.html");
const video = text("apps/edicao-de-video/index.html");
const foldersCss = text("assets/folders.css");
const settings = text("configuracoes.html");
const personalization = text("assets/personalization.css");
const settingsCss = text("assets/settings.css");
const js = text("assets/portal.js");
const css = text("assets/portal.css");
const cfg = JSON.parse(text("capacitor.config.json"));
const pkg = JSON.parse(text("package.json"));

assert.match(home, /<html lang="pt-BR"/, "HTML precisa da linguagem pt-BR");
assert.equal(home.split('class="app-card"').length - 1, 1, "A tela inicial deve ter um card nesta etapa");
assert.equal(home.split('class="folder-card ').length - 1, 2, "A Home deve ter duas pastas");
assert.match(home, /href="\.\/apps\/estoque\/index\.html"/);
assert.match(home, /href="\.\/apps\/edicao-de-video\/index\.html"/);
assert.match(home, /id="pastas"/);
assert.match(home, /assets\/folders\.css/);
assert.match(stock, /<h1 id="folder-title">Estoque<\/h1>/);
assert.match(video, /<h1 id="folder-title">Edição de vídeo<\/h1>/);
for (const folder of [stock, video]) {
  assert.match(folder, /href="\.\.\/\.\.\/index\.html#pastas"/);
  assert.match(folder, /href="\.\.\/\.\.\/configuracoes\.html"/);
  assert.match(folder, /assets\/personalization\.css/);
  assert.match(folder, /assets\/folders\.css/);
  assert.match(folder, /0 aplicativos/);
}
assert.match(foldersCss, /folder-grid/);
assert.match(js, /const folderCards/);
assert.match(js, /const appCards/);
assert.match(js, /folder-nav-count/);
assert.match(settings, /index\.html#pastas/);

assert.match(home, /href="\.\/apps\/primeiro-app\/index\.html"/);
assert.match(detail, /href="\.\.\/\.\.\/index\.html#apps"/);
assert.match(css, /@media \(max-width: 620px\)/);
assert.match(home, /href="\.\/configuracoes\.html"/);
assert.match(detail, /href="\.\.\/\.\.\/configuracoes\.html"/);
assert.match(settings, /data-setting="accent"/);
assert.match(settings, /data-setting="density"/);
assert.match(settings, /data-setting="effects"/);
assert.match(settings, /data-setting="sound"/);
assert.match(settings, /data-setting="volume"/);
assert.match(settings, /id="sound-preview"/);
assert.match(personalization, /data-accent="blue"/);
assert.match(settingsCss, /settings-panel/);
assert.match(js, /appspace\.preferences\.v1/);
assert.match(js, /AudioContext/);
assert.match(js, /sound: false/);
assert.match(js, /function playSound/);
assert.match(home, /assets\/personalization\.css/);
assert.match(detail, /assets\/personalization\.css/);
assert.match(settings, /assets\/settings\.css/);
assert.match(js, /function filterApps\(\)/);
assert.equal(cfg.webDir, "web");
assert.equal(cfg.android.path, "mobile/android");
assert.equal(pkg.main, "desktop/main.cjs");
assert.ok(pkg.build.files.includes("configuracoes.html"));

execFileSync(process.execPath, [path.join(root, "scripts/build-web.cjs")], { stdio: "inherit" });
for (const asset of ["index.html", "configuracoes.html", "assets/portal.css", "assets/personalization.css", "assets/settings.css", "assets/folders.css", "assets/portal.js", "apps/primeiro-app/index.html", "apps/estoque/index.html", "apps/edicao-de-video/index.html"]) {
  assert.equal(text(asset), text(path.join("web", asset)), "Cópia divergente: " + asset);
}
console.log("[AppSpace] Estrutura, links e cópia dos recursos: OK.");
