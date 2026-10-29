"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, session, protocol, net } = require("electron");

const PORTAL_ROOT = path.resolve(__dirname, "..");
const SCHEME = "appspace";
const HOST = "portal";

// URL local estável: o localStorage passa a ser compartilhado entre todas as páginas.
// Registrar ANTES do app.ready e manter a pasta estritamente confinada ao portal.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function resolveLocalURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== SCHEME + ":" || url.hostname !== HOST || url.port) return null;
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!relativePath || relativePath.includes("\\") || relativePath.includes("\0")) return null;
    const filename = path.resolve(PORTAL_ROOT, relativePath);
    const relative = path.relative(PORTAL_ROOT, filename);
    if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) return null;
    return filename;
  } catch (_) {
    return null;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1240,
    height: 790,
    minWidth: 360,
    minHeight: 500,
    show: false,
    backgroundColor: "#0b101b",
    autoHideMenuBar: true,
    title: "AppSpace",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged
    }
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.on("did-fail-load", (_event, code, description) => {
    console.error("[AppSpace] Falha ao abrir página:", code, description);
    if (!window.isVisible()) window.show();
  });
  window.loadURL(SCHEME + "://" + HOST + "/index.html");
  return window;
}

app.whenReady().then(() => {
  protocol.handle(SCHEME, (request) => {
    const filename = resolveLocalURL(request.url);
    if (!filename) return new Response("Recurso não permitido", { status: 403 });
    return net.fetch(pathToFileURL(filename).toString());
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, respond) => respond(false));

  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-navigate", (event, url) => {
      if (!resolveLocalURL(url)) event.preventDefault();
    });
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
