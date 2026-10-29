"use strict";

// Gera somente a pasta web/ utilizada pelo Capacitor.
// Não altera o site-fonte nem o projeto Android preexistente em app/.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "web");
const files = ["index.html"];
const directories = ["assets", "apps"];

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.statSync(source).isFile()) throw new Error("Arquivo ausente: " + file);
}
for (const name of directories) {
  const source = path.join(root, name);
  if (!fs.statSync(source).isDirectory()) throw new Error("Pasta ausente: " + name);
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of files) fs.copyFileSync(path.join(root, file), path.join(output, file));
for (const name of directories) {
  fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true });
}
console.log("[AppSpace] Site offline copiado para web/ com sucesso.");
