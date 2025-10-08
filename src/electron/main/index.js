import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  shell,
} from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import fs from "node:fs/promises";
import os from "node:os";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { WindowState } from "./window/window-state";
import { asyncMap, removeFirst } from "../../core/util/array-utils";
import { MenuEvent } from "../../core/controllers/menubar-controller";
import { isMac, isWindows } from "../../core/util/platform-utils";
import { MnemonicData } from "../../core/util/mnemonic-data";

let windows = [];
let pendingWindows = new Map();

let pendingMacOpenFiles = [];
let openPendingMacOpenFilesTimeout = null;
let macOpenFileHandler = (fsPath) => {
  pendingMacOpenFiles.push(fsPath);
};

if (!app.requestSingleInstanceLock({ argv: process.argv })) {
  app.quit();
} else {
  main();
}

function getLastActiveWindow() {
  return windows[windows.length - 1] || null;
}

function createMenuItemClick(state) {
  let eventType = JSON.stringify(state.eventType);
  let eventDetail = JSON.stringify(state.eventDetail);
  return (_menuItem, _browserWindow, _event) => {
    let window = getLastActiveWindow();
    if (!window) {
      window = newWindow();
      if (state.eventType === MenuEvent.NewWindow) {
        return;
      }
    }
    window.webContents.executeJavaScript(
      `emitNativeMenuEvent(${eventType}, ${eventDetail});`,
      true,
    );
    if (window.isMinimized()) {
      window.restore();
    }
  };
}

function createMenuItemConstructorOptions(state) {
  let result = {
    type: state.type,
    enabled: state.enabled,
  };

  if (result.type === "normal" || result.type === "checkbox") {
    createMenuItemLabel(result, state);
    result.role = state.role;
    if (state.keybinding) {
      result.accelerator = state.keybinding.electronLabel.string;
    }
    if (state.eventType) {
      result.click = createMenuItemClick(state);
    }
  }

  if (result.type === "checkbox") {
    result.checked = state.checked;
  }

  if (result.type === "submenu") {
    createMenuItemLabel(result, state);
    result.role = state.role;
    if (state.menu) {
      result.submenu = state.menu.items.map(createMenuItemConstructorOptions);
    }
  }

  return result;
}

function createMenuItemLabel(menuItemConstructorOptions, state) {
  if (state.label !== null) {
    menuItemConstructorOptions.label = new MnemonicData(state.label).string;
  }
}

function createMenubarTemplate(state) {
  return state.items.map(createMenuItemConstructorOptions);
}

function getWindowStateFilePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [`script-src 'self'`],
      },
    });
  });
}

function setupIPC() {
  ipcMain.on("menu:set-menubar-state", (event, state) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    if (window.isFocused()) {
      let template = createMenubarTemplate(state);
      let menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);
    }
  });

  ipcMain.on("app:add-recent-document", (_event, recentDocument) => {
    if (isWindows() || isMac()) {
      app.addRecentDocument(recentDocument);
    }
  });

  ipcMain.on("app:set-recent-documents", (_event, recentDocuments) => {
    if (isWindows() || isMac()) {
      app.clearRecentDocuments();
      for (const document of recentDocuments.reverse()) {
        app.addRecentDocument(document);
      }
    }
  });

  ipcMain.on("app:quit", (_event) => {
    app.quit();
  });

  ipcMain.on("window:toggle-dev-tools", (event) => {
    event.sender.toggleDevTools();
  });

  ipcMain.on("window:set-title", (event, title) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    window.setTitle(title);
  });

  ipcMain.on("window:set-document-edited", (event, documentEdited) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    window.setDocumentEdited(documentEdited);
  });

  ipcMain.on("window:set-represented-filename", (event, filename) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    window.setRepresentedFilename(filename);
  });

  ipcMain.on("window:set-closable", (event, closable) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    window?.setClosable(closable);
  });

  ipcMain.on("window:show-title-context-menu", (event, x, y) => {
    let window = BrowserWindow.fromWebContents(event.sender);

    let representedFileName = window.getRepresentedFilename();
    if (!representedFileName) {
      return;
    }

    const menuItems = [];
    const segments = representedFileName.split(path.sep);

    for (let i = segments.length - 1; i >= 0; i--) {
      const fsPath = segments.slice(0, i + 2).join(path.sep);
      menuItems.push({
        type: "normal",
        label: (segments[i] || path.sep).replace("&", "&&"),
        click: (_menuItem, _browserWindow, _event) => {
          shell.showItemInFolder(fsPath);
        },
      });
    }

    const menu = Menu.buildFromTemplate(menuItems);
    menu.popup({ window, x, y });
  });

  ipcMain.on("window:new", (_event) => {
    newWindow();
  });

  ipcMain.on("window:minimize", (event) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    window.minimize();
  });

  ipcMain.on("window:restore", (event) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    if (window.isMinimized()) {
      window.restore();
    }
  });

  ipcMain.on("window:maximize", (event) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    window.maximize();
  });

  ipcMain.on("window:unmaximize", (event) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    window.unmaximize();
  });

  ipcMain.on("window:close-request", (event) => {
    event.sender.send("window:close-request");
  });

  ipcMain.on("window:close", (event) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    if (windows.length === 1) {
      let state = WindowState.fromWindow(window);
      state.write(getWindowStateFilePath());
    }
    window.destroy();
    removeFirst(windows, window);
    pendingWindows.delete(window);
    showPendingWindows();
  });

  ipcMain.on("window:toggle-full-screen", (event) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    window.setFullScreen(!window.isFullScreen());
  });

  ipcMain.on("window:maximized-query", (event) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    event.returnValue = window.isMaximized();
  });

  ipcMain.on("window:full-screen-query", (event) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    event.returnValue = window.isFullScreen();
  });

  ipcMain.handle("fs:show-open-dialog", async (event, options) => {
    let window = BrowserWindow.fromWebContents(event.sender);

    let dialogResult = await dialog.showOpenDialog(window, options);
    let error = null;
    let returnValue = null;

    if (dialogResult.canceled) {
      error = "EABORTED";
    } else {
      try {
        returnValue = await asyncMap(dialogResult.filePaths, async (fsPath) =>
          pathToHandleData(fsPath),
        );
      } catch (e) {
        error = e.code;
      }
    }

    return {
      error,
      returnValue,
    };
  });

  ipcMain.handle("fs:show-save-dialog", async (event, options) => {
    let window = BrowserWindow.fromWebContents(event.sender);

    let dialogResult = await dialog.showSaveDialog(window, options);
    let error = null;
    let returnValue = null;

    if (dialogResult.canceled) {
      error = "EABORTED";
    } else {
      const fsPath = normalizePath(dialogResult.filePath);
      returnValue = {
        name: path.basename(fsPath),
        path: fsPath,
        kind: "file",
      };
    }

    return {
      error,
      returnValue,
    };
  });

  ipcMain.handle("fs:get-handle-data", async (_event, fsPath) => {
    return getHandleData(fsPath);
  });

  ipcMain.handle("fs:get-file-handle-data", async (_event, fsPath, create) => {
    let { error, returnValue } = await getHandleData(fsPath);

    if (create && error === "ENOENT") {
      await (await fs.open(fsPath, "w")).close();
      fsPath = normalizePath(fsPath);
      error = null;
      returnValue = {
        name: path.basename(fsPath),
        path: fsPath,
        kind: "file",
      };
    }

    if (returnValue?.kind !== "file") {
      error = "EMISMATCH";
      returnValue = null;
    }

    return { error, returnValue };
  });

  ipcMain.handle(
    "fs:get-directory-handle-data",
    async (_event, fsPath, create) => {
      let { error, returnValue } = await getHandleData(fsPath);

      if (create && error === "ENOENT") {
        await fs.mkdir(fsPath);
        fsPath = normalizePath(fsPath);
        error = null;
        returnValue = {
          name: path.basename(fsPath),
          path: fsPath,
          kind: "file",
        };
      }

      if (returnValue?.kind !== "directory") {
        error = "EMISMATCH";
        returnValue = null;
      }

      return { error, returnValue };
    },
  );

  ipcMain.handle("fs:read-file", async (_event, fsPath) => {
    let error = null;
    let returnValue = null;
    try {
      const stat = await fs.stat(fsPath);
      if (getHandleKind(stat) !== "file") {
        throwMismatch(stat);
      }
      returnValue = await fs.readFile(fsPath);
    } catch (e) {
      error = e.code;
    }
    return { error, returnValue };
  });

  ipcMain.handle("fs:write-file", async (_event, fsPath, data) => {
    let error = null;
    let returnValue = null;
    try {
      const handle = await fs.open(fsPath, "w");
      await handle.writeFile(data);
      await handle.close();
    } catch (e) {
      error = e.code;
    }
    return { error, returnValue };
  });

  ipcMain.on("os:platform", (event) => {
    event.returnValue = os.platform();
  });

  ipcMain.on("os:release", (event) => {
    event.returnValue = os.release();
  });
}

function setupWindowsJumpList() {
  if (isWindows()) {
    app.setJumpList([
      {
        type: "tasks",
        items: [
          {
            type: "task",
            title: "New Window",
            description: "Opens a new window",
            program: process.execPath,
            iconPath: process.execPath,
            iconIndex: 0,
          },
        ],
      },
      {
        type: "recent",
      },
    ]);
  }
}

function setupMacOpenFileHandler() {
  macOpenFileHandler = (fsPath) => {
    pendingMacOpenFiles.push(fsPath);

    if (openPendingMacOpenFilesTimeout !== null) {
      clearTimeout(openPendingMacOpenFilesTimeout);
    }

    openPendingMacOpenFilesTimeout = setTimeout(() => {
      openPendingMacOpenFiles();
      openPendingMacOpenFilesTimeout = null;
    }, 100);
  };
}

async function getHandleData(fsPath) {
  let error = null;
  let returnValue = null;
  try {
    returnValue = await pathToHandleData(fsPath);
  } catch (e) {
    error = e.code;
  }
  return { error, returnValue };
}

async function pathToHandleData(fsPath) {
  const stat = await fs.stat(fsPath);
  fsPath = normalizePath(fsPath);
  return {
    name: path.basename(fsPath),
    path: fsPath,
    kind: getHandleKind(stat),
  };
}

function normalizePath(fsPath) {
  let result = path.normalize(fsPath);
  if (isWindows()) {
    result = removeTrailingPathSeparator(result);
    if (result.endsWith(":")) {
      result += path.sep;
    }
  } else {
    result = removeTrailingPathSeparator(result);
    if (result.length === 0) {
      result += path.sep;
    }
  }
  return result;
}

function removeTrailingPathSeparator(fsPath) {
  if (fsPath.endsWith(path.sep)) {
    return fsPath.slice(0, -1);
  }
  return fsPath;
}

function getHandleKind(stat) {
  if (stat.isFile()) {
    return "file";
  } else if (stat.isDirectory()) {
    return "directory";
  } else {
    throwMismatch(stat);
  }
}

function throwMismatch(stat) {
  const error = new Error(`Unexpected handle kind for stat: ${stat}`);
  error.code = "EMISMATCH";
  throw error;
}

function newWindow() {
  const options = {
    width: 1024,
    height: 768,
    minWidth: 400,
    minHeight: 270,
    backgroundColor: "#1a1a1a",
    show: false,
    frame: isMac(),
    titleBarStyle: "hidden",
    webPreferences: {
      sandbox: true,
      v8CacheOptions: "bypassHeatCheck",
      preload: path.join(__dirname, "preload.js"),
    },
  };

  let state = null;
  let maximize = false;

  if (getLastActiveWindow()) {
    state = WindowState.cascade(getLastActiveWindow());
  } else {
    state = WindowState.read(getWindowStateFilePath());
  }

  if (state?.isVisibleOnAnyDisplay()) {
    options.x = state.x;
    options.y = state.y;
    options.width = state.width;
    options.height = state.height;
    maximize = state.maximized;
  }

  const window = new BrowserWindow(options);
  const mode = process.env.NODE_ENV || "development";

  if (mode === "development") {
    window.loadURL("http://localhost:9000");
  } else if (app.isPackaged) {
    window.loadFile("dist/electron/index.html");
  } else {
    window.loadFile("index.html");
  }

  const pendingWindowData = {
    callback: (pendingWindow) => {
      if (maximize) {
        pendingWindow.maximize();
      }
      pendingWindow.show();
    },
    readyToShow: false,
  };

  pendingWindows.set(window, pendingWindowData);

  window.once("ready-to-show", (_event) => {
    pendingWindowData.readyToShow = true;
    showPendingWindows();
  });

  window.on("minimize", (_event) => {
    window.webContents.send("window:minimized");
  });

  window.on("restore", (_event) => {
    window.webContents.send("window:restored");
  });

  window.on("maximize", (_event) => {
    window.webContents.send("window:maximized");
  });

  window.on("unmaximize", (_event) => {
    window.webContents.send("window:unmaximized");
  });

  window.on("enter-full-screen", (_event) => {
    window.webContents.send("window:enter-full-screen");
  });

  window.on("leave-full-screen", (_event) => {
    window.webContents.send("window:leave-full-screen");
  });

  window.on("close", (event) => {
    event.preventDefault();
    window.webContents.send("window:close-request");
  });

  window.on("focus", (_event) => {
    removeFirst(windows, window);
    windows.push(window);
    window.webContents.send("window:focus");
  });

  window.on("blur", (_event) => {
    window.webContents.send("window:blur");
  });

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  windows.push(window);

  return window;
}

function showPendingWindows() {
  for (const [pendingWindow, data] of pendingWindows.entries()) {
    if (data.readyToShow) {
      data.callback(pendingWindow);
      pendingWindows.delete(pendingWindow);
    } else {
      break;
    }
  }
}

function openFilesFromCommandLine(commandLine) {
  const argv = yargs(hideBin(commandLine)).argv;
  if (argv._.length > 0) {
    openFiles(argv._);
    return true;
  }
  return false;
}

function openPendingMacOpenFiles() {
  if (pendingMacOpenFiles.length > 0) {
    openFiles(pendingMacOpenFiles);
    pendingMacOpenFiles.length = 0;
    return true;
  }
  return false;
}

function openFiles(filenames) {
  for (const filename of filenames) {
    const window = newWindow();
    const fsPath = normalizePath(filename);
    window.once("ready-to-show", () => {
      window.webContents.send("open-file", {
        name: path.basename(fsPath),
        path: fsPath,
        kind: "file",
      });
    });
  }
}

function main() {
  app.on("open-file", (event, fsPath) => {
    event.preventDefault();
    macOpenFileHandler(fsPath);
  });

  app.on("ready", () => {
    setupCSP();
    setupIPC();
    setupWindowsJumpList();
    setupMacOpenFileHandler();
    if (!openFilesFromCommandLine(process.argv) && !openPendingMacOpenFiles()) {
      newWindow();
    }
    autoUpdater.checkForUpdates();
  });

  app.on(
    "second-instance",
    (_event, _commandLine, _workingDirectory, additionalData) => {
      if (!openFilesFromCommandLine(additionalData.argv)) {
        newWindow();
      }
    },
  );

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on("window-all-closed", (_event) => {
    if (!isMac()) {
      app.quit();
    }
  });

  app.on("activate", (_event) => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      newWindow();
    }
  });

  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = "info";

  Menu.setApplicationMenu(null);
}
