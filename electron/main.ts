import { app, BrowserWindow } from "electron";
import path from "node:path";

const DEV_SERVER_URL = "http://localhost:3000";

const isDev = !app.isPackaged;

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    void mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../out/index.html"));
  }

  registerBackForwardNavigation(mainWindow);

  return mainWindow;
}

/**
 * The app is a single-page Next.js client app loaded once via loadURL —
 * all in-app navigation happens through the History API (App Router), which
 * Chromium records as same-document session-history entries same as a
 * regular browser tab. Wires the OS-level back/forward affordances a
 * browser tab gets for free but a bare BrowserWindow does not: the mouse
 * side (thumb) buttons, and Alt+Left/Alt+Right as a keyboard fallback since
 * autoHideMenuBar leaves no visible menu bar to carry an accelerator.
 */
function registerBackForwardNavigation(window: BrowserWindow): void {
  // Windows/Linux mouse back/forward buttons surface as app-command events.
  window.on("app-command", (_event, command) => {
    if (command === "browser-backward" && window.webContents.navigationHistory.canGoBack()) {
      window.webContents.navigationHistory.goBack();
    } else if (
      command === "browser-forward" &&
      window.webContents.navigationHistory.canGoForward()
    ) {
      window.webContents.navigationHistory.goForward();
    }
  });

  window.webContents.on("before-input-event", (_event, input) => {
    const isArrowKey = input.key === "Left" || input.key === "Right";
    if (input.type !== "keyDown" || !isArrowKey || !input.alt) {
      return;
    }

    if (input.key === "Left" && window.webContents.navigationHistory.canGoBack()) {
      window.webContents.navigationHistory.goBack();
    } else if (input.key === "Right" && window.webContents.navigationHistory.canGoForward()) {
      window.webContents.navigationHistory.goForward();
    }
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
