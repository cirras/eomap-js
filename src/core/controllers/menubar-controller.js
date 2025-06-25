import { EventEmitter } from "eventemitter3";
import {
  MenubarState,
  MenuState,
  MenuItemState,
  CheckboxMenuItemState,
  SubmenuMenuItemState,
  DividerMenuItemState,
} from "../state/menubar-state";
import { isElectron, isLinux, isMac, isWindows } from "../util/platform-utils";

export const MenuEvent = {
  NewFile: "new-file",
  NewWindow: "new-window",
  Open: "open",
  OpenRecent: "open-recent",
  ClearRecent: "clear-recent",
  Save: "save",
  SaveAs: "save-as",
  MapProperties: "map-properties",
  Settings: "settings",
  ReloadGraphics: "reload-graphics",
  CloseWindow: "close-window",
  Quit: "quit",
  Undo: "undo",
  Redo: "redo",
  VisibilityFlagToggle: "visibility-flag-toggle",
  ReleaseNotes: "release-notes",
  DevTools: "toggle-developer-tools",
  About: "about",
};

export class MenuEventSource {
  constructor() {
    this.listeners = [];
  }

  addEventListener(listener) {
    this.listeners.push(listener);
  }

  removeEventListener(listener) {
    this.listeners = this.listeners.filter((item) => item !== listener);
  }

  emit(event) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export class DOMMenuEventSource extends MenuEventSource {
  constructor(node) {
    super();
    for (let key in MenuEvent) {
      let eventType = MenuEvent[key];
      node.addEventListener(eventType, (event) => this.emit(event));
    }
  }
}

export class MenubarController extends EventEmitter {
  onWindowKeyDown = (event) => {
    for (let keybinding of this.keybindingMap.keys()) {
      if (keybinding.triggeredBy(event)) {
        let item = this.keybindingMap.get(keybinding);

        if (item.enabled || item.eventCaptureMode === EventCaptureMode.Always) {
          event.preventDefault();
          event.stopPropagation();
        }

        if (item.enabled) {
          this.handleMenuEvent(
            new CustomEvent(item.eventType, { detail: item.eventDetail }),
          ).catch((reason) => {
            console.error(reason);
          });
          this.emit("keybinding-handled");
        }

        break;
      }
    }
  };

  constructor(application) {
    super();
    this.application = application;
    this.state = new MenubarState();
    this.keybindingMap = new Map();
    this.eventSources = [];

    this._closed = false;
    this._minimized = false;

    application.addController(this);
    window.addEventListener("keydown", this.onWindowKeyDown);
  }

  addEventSource(eventSource) {
    eventSource.addEventListener((event) => this.handleMenuEvent(event));
    this.eventSources.push(eventSource);
  }

  updateMenubarState() {
    let newState = this.generateMenubarState();
    if (JSON.stringify(this.state) !== JSON.stringify(newState)) {
      this.state = newState;
      this.collectKeybindings();
      this.emit("menubar-state-updated", this.state);
    }
  }

  generateMenubarState() {
    let items = [];

    if (isElectron() && isMac()) {
      items.push(
        new SubmenuMenuItemState()
          .withLabel("App")
          .withMenu(this.generateAppMenu()),
      );
    }

    items.push(
      new SubmenuMenuItemState()
        .withLabel("&File")
        .withMenu(this.generateFileMenu()),
      new SubmenuMenuItemState()
        .withLabel("&Edit")
        .withMenu(this.generateEditMenu()),
      new SubmenuMenuItemState()
        .withLabel("&View")
        .withMenu(this.generateViewMenu()),
    );

    if (isElectron() && isMac()) {
      items.push(new SubmenuMenuItemState().withRole("windowMenu"));
    }

    items.push(
      new SubmenuMenuItemState()
        .withLabel("&Help")
        .withMenu(this.generateHelpMenu()),
    );

    return new MenubarState(items);
  }

  generateAppMenu() {
    return new MenuState([
      new MenuItemState()
        .withLabel("About Endless Map Editor")
        .withEventType(MenuEvent.About)
        .withEnabled(this.canShowAbout),
      new DividerMenuItemState(),
      new MenuItemState()
        .withLabel("Preferences...")
        .withEventType(MenuEvent.Settings)
        .withKeybinding("Command+,")
        .withEnabled(this.canAccessSettings),
      new DividerMenuItemState(),
      new SubmenuMenuItemState()
        .withRole("services")
        .withMenu(new MenuState([])),
      new DividerMenuItemState(),
      new MenuItemState().withRole("hide"),
      new MenuItemState().withRole("hideOthers"),
      new MenuItemState().withRole("unhide"),
      new DividerMenuItemState(),
      new MenuItemState()
        .withLabel("Reload Graphics")
        .withEventType(MenuEvent.ReloadGraphics)
        .withEnabled(this.canReloadGraphics),
      new DividerMenuItemState(),
      new MenuItemState().withRole("quit"),
    ]);
  }

  generateFileMenu() {
    let items = [
      new MenuItemState()
        .withLabel("&New File...")
        .withEventType(MenuEvent.NewFile)
        .withKeybinding("CommandOrControl+Alt+N")
        .withEnabled(this.canOpenMaps),
    ];

    if (isElectron()) {
      items.push(
        new MenuItemState()
          .withLabel("New &Window")
          .withEventType(MenuEvent.NewWindow)
          .withKeybinding("CommandOrControl+Shift+N"),
      );
    }

    items.push(
      new DividerMenuItemState(),
      new MenuItemState()
        .withLabel("&Open...")
        .withEventType(MenuEvent.Open)
        .withKeybinding("CommandOrControl+O")
        .withEnabled(this.canOpenMaps),
      new SubmenuMenuItemState()
        .withLabel("Open &Recent")
        .withMenu(this.generateRecentFilesMenu())
        .withEnabled(this.canOpenMaps),
      new DividerMenuItemState(),
      new MenuItemState()
        .withLabel("&Save")
        .withEventType(MenuEvent.Save)
        .withKeybinding("CommandOrControl+S")
        .withEnabled(this.canSaveMaps),
      new MenuItemState()
        .withLabel("Save &As...")
        .withEventType(MenuEvent.SaveAs)
        .withKeybinding("CommandOrControl+Shift+S")
        .withEnabled(this.canSaveMaps),
      new DividerMenuItemState(),
      new MenuItemState()
        .withLabel("Map &Properties")
        .withEventType(MenuEvent.MapProperties)
        .withEnabled(this.canAccessMapProperties),
    );

    items.push(new DividerMenuItemState());

    if (isElectron() && isMac()) {
      items.push(
        new MenuItemState()
          .withLabel("Close Window")
          .withEventType(MenuEvent.CloseWindow)
          .withKeybinding("Command+W")
          .withEnabled(this.canCloseWindow),
      );
    } else {
      items.push(
        new MenuItemState()
          .withLabel("&Settings")
          .withEventType(MenuEvent.Settings)
          .withKeybinding("CommandOrControl+,")
          .withEnabled(this.canAccessSettings),
        new DividerMenuItemState(),
        new MenuItemState()
          .withLabel("Reload &Graphics")
          .withEventType(MenuEvent.ReloadGraphics)
          .withKeybinding("CommandOrControl+R")
          .withEnabled(this.canReloadGraphics),
      );
    }

    if (isElectron()) {
      if (isWindows()) {
        items.push(
          new DividerMenuItemState(),
          new MenuItemState()
            .withLabel("E&xit")
            .withEventType(MenuEvent.CloseWindow)
            .withEnabled(this.canCloseWindow),
        );
      } else if (isLinux()) {
        items.push(
          new DividerMenuItemState(),
          new MenuItemState()
            .withLabel("&Close Window")
            .withEventType(MenuEvent.CloseWindow)
            .withKeybinding("Ctrl+W")
            .withEnabled(this.canCloseWindow),
          new MenuItemState()
            .withLabel("&Quit")
            .withEventType(MenuEvent.Quit)
            .withKeybinding("Ctrl+Q")
            .withEnabled(this.canCloseWindow),
        );
      }
    }

    return new MenuState(items).withWidth(250);
  }

  generateRecentFilesMenu() {
    const items = this.recentFiles
      .slice(0, 10)
      .map((handle, index) =>
        new MenuItemState()
          .withLabel(escapeMnemonics(handle.path))
          .withEventType(MenuEvent.OpenRecent)
          .withEventDetail(index)
          .withEnabled(this.canOpenMaps),
      );

    if (items.length > 0) {
      items.push(new DividerMenuItemState());
    }

    if (items.length > 0 || (isElectron() && isMac())) {
      items.push(
        new MenuItemState()
          .withLabel(isMac() ? "Clear Menu" : "&Clear Recently Opened")
          .withEventType(MenuEvent.ClearRecent)
          .withEnabled(items.length > 0),
      );
    }
    return new MenuState(items);
  }

  generateEditMenu() {
    return new MenuState([
      new MenuItemState()
        .withLabel("&Undo")
        .withEventType(MenuEvent.Undo)
        .withKeybinding("CommandOrControl+Z")
        .withEnabled(this.canUndo),
      new MenuItemState()
        .withLabel("&Redo")
        .withEventType(MenuEvent.Redo)
        .withKeybinding(...this.getRedoAccelerators())
        .withEnabled(this.canRedo),
    ]);
  }

  getRedoAccelerators() {
    let result = ["CommandOrControl+Shift+Z"];
    if (!isMac()) {
      result.unshift("Control+Y");
    }
    return result;
  }

  generateViewMenu() {
    const MENU_SEPARATOR = null;
    // prettier-ignore
    const MENU_ITEM_DATA = [
      { label: "&Ground",     kbd: "CommandOrControl+1", flag: 0 },
      { label: "&Objects",    kbd: "CommandOrControl+2", flag: 1 },
      { label: "O&verlay",    kbd: "CommandOrControl+3", flag: 2 },
      { label: "&Down Wall",  kbd: "CommandOrControl+4", flag: 3 },
      { label: "&Right Wall", kbd: "CommandOrControl+5", flag: 4 },
      { label: "Roo&f",       kbd: "CommandOrControl+6", flag: 5 },
      { label: "&Top",        kbd: "CommandOrControl+7", flag: 6 },
      { label: "&Shadow",     kbd: "CommandOrControl+8", flag: 7 },
      { label: "Overlay &2",  kbd: "CommandOrControl+9", flag: 8 },
      { label: "S&pecial",    kbd: "CommandOrControl+0", flag: 9 },
      { label: "&Entities",   kbd: "CommandOrControl+E", flag: 10 },
      MENU_SEPARATOR,
      { label: "Grid &Lines", kbd: "CommandOrControl+G", flag: 11 },
    ];

    return new MenuState(
      MENU_ITEM_DATA.map((info) =>
        info === MENU_SEPARATOR
          ? new DividerMenuItemState()
          : new CheckboxMenuItemState()
              .withLabel(info.label)
              .withEventType(MenuEvent.VisibilityFlagToggle)
              .withEventDetail(info.flag)
              .withKeybinding(info.kbd)
              .withChecked(this.layerVisibility.isFlagActive(info.flag))
              .withEnabled(this.canToggleLayerVisibility(info.flag)),
      ),
    );
  }

  generateHelpMenu() {
    const items = [
      new MenuItemState()
        .withLabel("&Release Notes")
        .withEventType(MenuEvent.ReleaseNotes),
      new DividerMenuItemState(),
    ];

    if (isElectron()) {
      items.push(
        new MenuItemState()
          .withLabel("Toggle Developer Tools")
          .withEventType(MenuEvent.DevTools)
          .withKeybinding(isMac() ? "Alt+Command+I" : "Ctrl+Shift+I")
          .withEnabled(this.canToggleDevTools),
        new DividerMenuItemState(),
      );
    }

    if (!(isElectron() && isMac())) {
      items.push(
        new MenuItemState()
          .withLabel("&About")
          .withEventType(MenuEvent.About)
          .withEnabled(this.canShowAbout),
      );
    }

    return new MenuState(items);
  }

  collectKeybindings() {
    this.keybindingMap.clear();
    this.state.items.forEach((item) =>
      this.collectKeybindingsFromMenuItem(item),
    );
  }

  collectKeybindingsFromMenuItem(item) {
    if (item.keybinding) {
      if (!(isElectron() && isMac())) {
        this.keybindingMap.set(item.keybinding, item);
      }
      for (let keybinding of item.alternateKeybindings) {
        this.keybindingMap.set(keybinding, item);
      }
    }

    if (item.type === "submenu" && item.menu) {
      item.menu.items.forEach((subItem) =>
        this.collectKeybindingsFromMenuItem(subItem),
      );
    }
  }

  hostUpdated() {
    this.updateMenubarState();
  }

  async handleMenuEvent(event) {
    // Defer to next tick
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (this.hasOpenOverlay && event.type !== MenuEvent.DevTools) {
      return;
    }

    switch (event.type) {
      case MenuEvent.NewFile:
        this.application.showNewMap();
        break;
      case MenuEvent.NewWindow:
        window.bridge.newWindow();
        break;
      case MenuEvent.Open:
        this.application.open();
        break;
      case MenuEvent.OpenRecent:
        this.application.openRecent(event.detail);
        break;
      case MenuEvent.ClearRecent:
        this.application.clearRecent();
        break;
      case MenuEvent.Save:
        this.application.save();
        break;
      case MenuEvent.SaveAs:
        this.application.saveAs();
        break;
      case MenuEvent.MapProperties:
        this.application.showMapProperties();
        break;
      case MenuEvent.Settings:
        this.application.showSettings();
        break;
      case MenuEvent.ReloadGraphics:
        this.application.loadGFX();
        break;
      case MenuEvent.CloseWindow:
        window.bridge.requestClose();
        break;
      case MenuEvent.Quit:
        window.bridge.quit();
        break;
      case MenuEvent.Undo:
        this.application.undo();
        break;
      case MenuEvent.Redo:
        this.application.redo();
        break;
      case MenuEvent.VisibilityFlagToggle:
        this.application.toggleVisibilityFlag(event.detail);
        break;
      case MenuEvent.ReleaseNotes:
        window.open(RELEASE_NOTES_URL, "_blank");
        break;
      case MenuEvent.DevTools:
        window.bridge.toggleDevTools();
        break;
      case MenuEvent.About:
        this.application.showAbout();
        break;
    }
  }

  get canOpenMaps() {
    return !this.hasOpenOverlay;
  }

  get canSaveMaps() {
    return (
      this.application.mapState.loaded &&
      this.windowVisible &&
      !this.hasOpenOverlay
    );
  }

  get canAccessMapProperties() {
    return (
      this.application.validGfx() &&
      this.application.mapState.loaded &&
      this.windowVisible &&
      !this.hasOpenOverlay
    );
  }

  get canAccessSettings() {
    return (
      this.application.settingsState != null &&
      this.windowVisible &&
      !this.hasOpenOverlay
    );
  }

  get canReloadGraphics() {
    return (
      this.application.canReloadGraphics() &&
      this.windowVisible &&
      !this.hasOpenOverlay
    );
  }

  get canUndo() {
    return (
      this.application.canUndo() && this.windowVisible && !this.hasOpenOverlay
    );
  }

  get canRedo() {
    return (
      this.application.canRedo() && this.windowVisible && !this.hasOpenOverlay
    );
  }

  canToggleLayerVisibility(flag) {
    return (
      !this.layerVisibility.isFlagOverridden(flag) &&
      this.windowVisible &&
      !this.hasOpenOverlay
    );
  }

  get canToggleDevTools() {
    return this.windowVisible;
  }

  get canShowAbout() {
    return !this.hasOpenOverlay;
  }

  get canCloseWindow() {
    return this.windowVisible && !this.application.hasOpenPrompt;
  }

  get recentFiles() {
    return this.application.recentFiles;
  }

  get layerVisibility() {
    return this.application.layerVisibility;
  }

  get windowVisible() {
    return !this._closed && !this._minimized;
  }

  get hasOpenOverlay() {
    return (
      !this._closed &&
      (this.application.hasOpenPrompt || this.application.hasOpenModal)
    );
  }

  set closed(value) {
    this._closed = value;
    this.updateMenubarState();
  }

  set minimized(value) {
    this._minimized = value;
    this.updateMenubarState();
  }
}

function escapeMnemonics(string) {
  return string.replace("&", "&&");
}
