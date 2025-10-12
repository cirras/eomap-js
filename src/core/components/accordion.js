import { html } from "lit";
import { customElement, queryAssignedNodes } from "lit/decorators.js";

import { Focusable, getActiveElement } from "@spectrum-web-components/shared";

import styles from "@spectrum-web-components/accordion/src/accordion.css.js";

@customElement("eomap-accordion")
export class Accordion extends Focusable {
  static get styles() {
    return [styles];
  }

  @queryAssignedNodes()
  defaultNodes;

  get items() {
    return [...(this.defaultNodes || [])].filter(
      (node) => node.tagName !== undefined,
    );
  }

  focus() {
    if (this.focusElement !== this) {
      super.focus();
    }
  }

  get focusElement() {
    const items = this.items;
    if (items?.length) {
      let index = 0;
      while (index < items.length && items[index].disabled) {
        index += 1;
      }
      if (items[index]) {
        return items[index];
      }
    }
    return this;
  }

  startListeningToKeyboard() {
    const items = this.items;
    if (items?.length) {
      this.addEventListener("keydown", this.handleKeyDown);
    }
  }

  stopListeningToKeyboard() {
    this.removeEventListener("keydown", this.handleKeyDown);
  }

  handleKeyDown(event) {
    const { key } = event;
    if (key !== "ArrowDown" && key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const direction = key === "ArrowDown" ? 1 : -1;
    this.focusItemByOffset(direction);
  }

  focusItemByOffset(direction) {
    const items = this.items;
    const focused = items.indexOf(getActiveElement(this));
    let next = focused;
    let nextItem = items[next];

    while (nextItem && (nextItem.disabled || next === focused)) {
      next = (items.length + next + direction) % items.length;
      nextItem = items[next];
    }

    if (!nextItem || nextItem.disabled || next === focused) {
      return;
    }

    nextItem.focus();
  }

  expand() {
    for (let item of this.items) {
      item.open = true;
    }
  }

  onToggle(event) {
    if (event.target !== document.activeElement) {
      event.preventDefault();
      document.activeElement.click();
    }
  }

  render() {
    return html` <slot @sp-accordion-item-toggle=${this.onToggle}></slot> `;
  }

  firstUpdated(changedProperties) {
    super.firstUpdated(changedProperties);
    this.addEventListener("focusin", this.startListeningToKeyboard);
    this.addEventListener("focusout", this.stopListeningToKeyboard);
  }
}
