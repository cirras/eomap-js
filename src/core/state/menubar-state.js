import { KeybindingState } from "./keybinding-state";

export const EventCaptureMode = {
  Always: "always",
  WhenEnabled: "when-enabled",
};

export class MenuItemState {
  constructor() {
    this.type = "normal";
    this.role = null;
    this.label = null;
    this.eventType = null;
    this.eventDetail = null;
    this.eventCaptureMode = EventCaptureMode.WhenEnabled;
    this.keybinding = null;
    this.alternateKeybindings = [];
    this.enabled = true;
  }

  copy() {
    let copy = new MenuItemState(this.label);
    copy.role = this.role;
    copy.label = this.label;
    copy.eventType = this.eventType;
    copy.eventDetail = this.eventDetail;
    copy.eventCaptureMode = this.eventCaptureMode;
    copy.keybinding = this.keybinding;
    copy.alternateKeybindings = [...this.alternateKeybindings];
    copy.enabled = this.enabled;
    return copy;
  }

  withRole(role) {
    let copy = this.copy();
    copy.role = role;
    return copy;
  }

  withLabel(label) {
    let copy = this.copy();
    copy.label = label;
    return copy;
  }

  withEventType(eventType) {
    let copy = this.copy();
    copy.eventType = eventType;
    return copy;
  }

  withEventDetail(eventDetail) {
    let copy = this.copy();
    copy.eventDetail = eventDetail;
    return copy;
  }

  withEventCaptureMode(eventCaptureMode) {
    let copy = this.copy();
    copy.eventCaptureMode = eventCaptureMode;
    return copy;
  }

  withKeybinding(...accelerators) {
    let copy = this.copy();
    copy.keybinding = null;
    copy.alternateKeybindings = [];
    for (let i = 0; i < accelerators.length; ++i) {
      let keybinding = new KeybindingState(accelerators[i]);
      if (i === 0) {
        copy.keybinding = keybinding;
      } else {
        copy.alternateKeybindings.push(keybinding);
      }
    }
    return copy;
  }

  withEnabled(enabled) {
    let copy = this.copy();
    copy.enabled = enabled;
    return copy;
  }
}

export class CheckboxMenuItemState extends MenuItemState {
  constructor() {
    super();
    this.type = "checkbox";
    this.checked = false;
  }

  copy() {
    let copy = new CheckboxMenuItemState();
    copy.role = this.role;
    copy.label = this.label;
    copy.eventType = this.eventType;
    copy.eventDetail = this.eventDetail;
    copy.eventCaptureMode = this.eventCaptureMode;
    copy.keybinding = this.keybinding;
    copy.alternateKeybindings = [...this.alternateKeybindings];
    copy.enabled = this.enabled;
    copy.checked = this.checked;
    return copy;
  }

  withChecked(checked) {
    let copy = this.copy();
    copy.checked = checked;
    return copy;
  }
}

export class SubmenuMenuItemState {
  constructor() {
    this.type = "submenu";
    this.role = null;
    this.label = null;
    this.menu = null;
    this.enabled = true;
  }

  copy() {
    let copy = new SubmenuMenuItemState();
    copy.role = this.role;
    copy.label = this.label;
    copy.menu = this.menu;
    copy.enabled = this.enabled;
    return copy;
  }

  withRole(role) {
    let copy = this.copy();
    copy.role = role;
    return copy;
  }

  withLabel(label) {
    let copy = this.copy();
    copy.label = label;
    return copy;
  }

  withMenu(menu) {
    let copy = this.copy();
    copy.menu = menu;
    return copy;
  }

  withEnabled(enabled) {
    let copy = this.copy();
    copy.enabled = enabled;
    return copy;
  }
}

export class DividerMenuItemState {
  constructor() {
    this.enabled = true;
    this.type = "separator";
  }
}

export class MenuState {
  constructor(items) {
    this.items = items;
    this.width = null;
  }

  copy() {
    let copy = new MenuState(this.items);
    copy.width = this.width;
    return copy;
  }

  withWidth(width) {
    let copy = this.copy();
    copy.width = width;
    return copy;
  }
}

export class MenubarState {
  constructor(items) {
    this.items = items || [];
  }
}
