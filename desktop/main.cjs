"use strict";

const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { app, BrowserWindow, session } = require("electron");

const PORTAL_ROOT = path.resolve(__dirname, "..");

function isLocalPortalURL(value) {
  try {
    const target = new URL(value);
    if (target.protocol !== "file:") return false;
    const localPath = path.normalize(fileURLToPath(target));
    const relative = path.relative(PORTAL_ROOT, localPath);
    return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
  } catch {
    return false;
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
  window.loadFile(path.join(PORTAL_ROOT, "index.html"));
  return window;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, respond) => respond(false));

  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-navigate", (event, url) => {
      if (!isLocalPortalURL(url)) event.preventDefault();
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
