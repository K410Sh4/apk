"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const text = (name) => fs.readFileSync(path.join(root, name), "utf8");

const home = text("index.html");
const detail = text("apps/primeiro-app/index.html");
const js = text("assets/portal.js");
const css = text("assets/portal.css");
const cfg = JSON.parse(text("capacitor.config.json"));
const pkg = JSON.parse(text("package.json"));

assert.match(home, /<html lang="pt-BR"/, "HTML precisa da linguagem pt-BR");
assert.equal(home.split('class="app-card"').length - 1, 1, "A tela inicial deve ter um card nesta etapa");
assert.match(home, /href="\.\/apps\/primeiro-app\/index\.html"/);
assert.match(detail, /href="\.\.\/\.\.\/index\.html#apps"/);
assert.match(css, /@media \(max-width: 620px\)/);
assert.match(js, /function filterApps\(\)/);
assert.equal(cfg.webDir, "web");
assert.equal(cfg.android.path, "mobile/android");
assert.equal(pkg.main, "desktop/main.cjs");

execFileSync(process.execPath, [path.join(root, "scripts/build-web.cjs")], { stdio: "inherit" });
for (const asset of ["index.html", "assets/portal.css", "assets/portal.js", "apps/primeiro-app/index.html"]) {
  assert.equal(text(asset), text(path.join("web", asset)), "Cópia divergente: " + asset);
}
console.log("[AppSpace] Estrutura, links e cópia dos recursos: OK.");
