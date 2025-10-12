import fs from "node:fs";
import { screen } from "electron";

export class WindowState {
  constructor(x, y, width, height, maximized) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.maximized = maximized;
  }

  static fromWindow(window) {
    const bounds = window.getNormalBounds();
    return new WindowState(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      window.isMaximized(),
    );
  }

  static read(path) {
    try {
      let json = JSON.parse(fs.readFileSync(path));
      if (!isValidStateJSON(json)) {
        throw new Error("JSON does not contain expected data.");
      }
      return new WindowState(
        json.x,
        json.y,
        json.width,
        json.height,
        json.maximized,
      );
    } catch (e) {
      console.error("Failed to read window state", e);
      return null;
    }
  }

  write(path) {
    try {
      fs.writeFileSync(path, JSON.stringify(this));
    } catch (e) {
      console.error("Failed to write window state", e);
    }
  }

  isVisibleOnAnyDisplay() {
    return findVisibleDisplays(this).length > 0;
  }

  static cascade(window) {
    const windowBounds = window.getNormalBounds();
    const display = screen.getDisplayNearestPoint({
      x: windowBounds.x + windowBounds.width,
      y: windowBounds.y + windowBounds.height,
    });
    const displayLeft = display.bounds.x;
    const displayRight = displayLeft + display.bounds.width;
    const displayTop = display.bounds.y;
    const displayBottom = displayTop + display.bounds.height;

    let x = windowBounds.x + 20;
    let y = windowBounds.y + 20;
    const width = windowBounds.width;
    const height = windowBounds.height;

    if (x < displayLeft || x + width > displayRight) {
      x = displayLeft;
    }

    if (y < displayTop || y + height > displayBottom) {
      y = displayTop;
    }

    return new WindowState(x, y, width, height, window.isMaximized());
  }
}

function findVisibleDisplays(state) {
  return screen.getAllDisplays().filter((display) => {
    let bounds = display.bounds;
    return (
      state.x + state.width >= bounds.x &&
      state.x < bounds.x + bounds.width &&
      state.y >= bounds.y &&
      state.y < bounds.y + bounds.height
    );
  });
}

function isValidStateJSON(json) {
  return (
    Number.isInteger(json.x) &&
    Number.isInteger(json.y) &&
    Number.isInteger(json.width) &&
    Number.isInteger(json.height) &&
    typeof json.maximized === "boolean"
  );
}
