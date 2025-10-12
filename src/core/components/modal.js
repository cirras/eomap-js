import {
  css,
  html,
  render,
  SpectrumElement,
} from "@spectrum-web-components/base";
import {
  customElement,
  property,
  query,
} from "@spectrum-web-components/base/src/decorators.js";
import { reparentChildren } from "@spectrum-web-components/shared/src/reparent-children.js";

import "./dialog-wrapper";

import { Overlay } from "@spectrum-web-components/overlay";

@customElement("eomap-modal")
export class Modal extends SpectrumElement {
  static get styles() {
    return css`
      :host {
        display: none;
      }
    `;
  }
  @query("slot")
  dialogContent;

  @property({ type: Boolean, reflect: true })
  open = false;

  @property({ type: Boolean, reflect: true })
  error = false;

  @property({ attribute: "cancel-label" })
  cancelLabel = "";

  @property({ attribute: "confirm-label" })
  confirmLabel = "";

  @property({ type: Boolean, reflect: true, attribute: "no-divider" })
  noDivider = false;

  @property({ type: String })
  headline = "";

  @property({ type: Number })
  width = null;

  dialogWrapperFragment = null;
  dialogWrapper = null;
  restoreChildren = null;
  openStatePromise = Promise.resolve();
  openStateResolver = null;
  closeOverlayCallback = null;

  constructor() {
    super();
    this.addEventListener("sp-closed", async (event) => {
      event.stopPropagation();
      if (this.restoreChildren) {
        this.restoreChildren();
        this.restoreChildren = null;
      }
      this.closeOverlayCallback = null;
      this.open = false;
      this.dispatchEvent(new Event("close"));
    });
  }

  close(immediate) {
    this.open = false;
    if (this.dialogWrapper) {
      this.dialogWrapper.open = false;
    }
    if (immediate) {
      this.closeOverlay();
    }
  }

  closeOverlay() {
    if (this.closeOverlayCallback) {
      this.closeOverlayCallback();
      this.closeOverlayCallback = null;
    }
  }

  async openOverlay() {
    if (this.closeOverlayCallback) {
      return;
    }

    this.generateDialogWrapper();

    let content = this.dialogContent?.assignedElements({ flatten: true }) ?? [];
    if (content.length === 0) {
      this.close(true);
      return;
    }

    this.restoreChildren = reparentChildren(
      content,
      this.dialogWrapper,
      (_element) => {
        return (element) => {
          if (element.focused !== undefined) {
            element.focused = false;
          }
        };
      },
    );

    this.openStatePromise = new Promise(
      (res) => (this.openStateResolver = res),
    );
    this.addEventListener(
      "sp-opened",
      () => {
        this.openStateResolver();
      },
      { once: true },
    );

    this.closeOverlayCallback = await Overlay.open(
      this,
      "modal",
      this.dialogWrapper,
      this.overlayOptions,
    );
  }

  generateDialogWrapper() {
    if (!this.dialogWrapperFragment) {
      this.dialogWrapperFragment = document.createDocumentFragment();
    }
    render(this.renderDialogWrapper(), this.dialogWrapperFragment, {
      host: this,
    });
    this.dialogWrapper = this.dialogWrapperFragment.children[0];
  }

  get overlayOptions() {
    return {
      offset: 6,
      placement: "none",
      receivesFocus: "auto",
      notImmediatelyClosable: true,
    };
  }

  confirm(event) {
    event.stopPropagation();
    this.dispatchEvent(new Event("confirm"));
  }

  cancel(event) {
    event.stopPropagation();
    this.dispatchEvent(new Event("cancel"));
  }

  renderDialogWrapper() {
    return html`
      <eomap-dialog-wrapper
        ?error=${this.error}
        .cancelLabel=${this.cancelLabel}
        .confirmLabel=${this.confirmLabel}
        .noDivider=${this.noDivider}
        .headline=${this.headline}
        @confirm=${this.confirm}
        @cancel=${this.cancel}
        @close=${this.closeOverlay}
        style="--eomap-dialog-wrapper-width: ${this.dialogWrapperWidth}"
      >
      </eomap-dialog-wrapper>
    `;
  }

  render() {
    return html`<slot></slot>`;
  }

  async updated(changes) {
    super.updated(changes);
    if (changes.has("open")) {
      if (this.open) {
        this.openOverlay();
      } else {
        this.close();
      }
    }
  }

  async getUpdateComplete() {
    const complete = await super.getUpdateComplete();
    await this.openStatePromise;
    return complete;
  }

  disconnectedCallback() {
    this.close(true);
    super.disconnectedCallback();
  }

  get dialogWrapperWidth() {
    if (this.width === null) {
      return "100%";
    }
    return `${this.width}px`;
  }
}
