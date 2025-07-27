import { css, html, LitElement } from "@spectrum-web-components/base";
import {
  customElement,
  property,
  query,
} from "@spectrum-web-components/base/src/decorators";

import "@spectrum-web-components/field-label/sp-field-label.js";
import "@spectrum-web-components/action-button/sp-action-button.js";

import {
  CloseIcon,
  FolderOpenIcon,
} from "@spectrum-web-components/icons-workflow";
import { Textfield } from "@spectrum-web-components/textfield";

import { FileSystemProvider } from "../filesystem/file-system-provider";
import { FileSystemHandle } from "../filesystem/file-system-handle";

@customElement("eomap-folder-textfield")
export class FolderTextfield extends Textfield {
  static get styles() {
    return [
      ...super.styles,
      css`
        :host {
          --spectrum-textfield-m-texticon-validation-icon-color-valid: var(
            --spectrum-alias-text-color
          );
          --spectrum-textfield-texticon-success-icon-width: 15px;
          --spectrum-textfield-texticon-success-icon-height: 15px;
          --spectrum-textfield-texticon-invalid-icon-width: 15px;
          --spectrum-textfield-texticon-invalid-icon-height: 15px;
          --spectrum-textfield-texticon-padding-top: 7px;
          width: unset;
        }
        .input {
          cursor: pointer;
          font-family: var(--spectrum-global-font-family-code);
          font-size: 12px;
          transition:
            background var(--spectrum-global-animation-duration-100, 0.13s)
              ease-out,
            border-color var(--spectrum-global-animation-duration-100, 0.13s)
              ease-out;
        }
        :host(:hover) .input {
          --spectrum-textfield-m-texticon-background-color: var(
            --spectrum-global-color-gray-75
          );
        }
        :host([focused][hidefocusring]) .input {
          --spectrum-textfield-m-texticon-border-color-key-focus: var(
            --spectrum-alias-border-color-hover
          );
          --spectrum-textfield-m-texticon-border-color-invalid-key-focus: var(
            --spectrum-semantic-negative-color-state-hover
          );
          --spectrum-textfield-m-texticon-background-color: var(
            --spectrum-global-color-gray-75
          );
          box-shadow: none;
        }
        :host(:active) .input {
          --spectrum-textfield-m-texticon-background-color: var(
            --spectrum-global-color-gray-200
          ) !important;
        }
        :host([hidefocusring]) #textfield::after {
          box-shadow: none;
        }
      `,
    ];
  }

  @property({ type: Boolean, reflect: true })
  readonly = true;

  @property({ type: Boolean, reflect: true })
  hideFocusRing = false;

  constructor() {
    super();
    this.addEventListener("keydown", (event) => {
      if (event.code === "Enter" || event.code === "Space") {
        this.hideFocusRing = true;
        this.click();
        event.stopPropagation();
      }
    });
    this.addEventListener("pointerdown", (_event) => {
      this.hideFocusRing = true;
    });
  }

  renderStateIcons() {
    return html`<sp-icon class="icon">${FolderOpenIcon()}</sp-icon>`;
  }

  render() {
    return html`
      <span
        tabindex="${this.focused ? "-1" : "0"}"
        @focus=${this.onHelperFocus}
      ></span>
      ${super.render()}
      <span
        tabindex="${this.focused ? "-1" : "0"}"
        @focus=${this.onHelperFocus}
      ></span>
    `;
  }

  onHelperFocus() {
    this.hideFocusRing = false;
    this.inputElement.focus();
  }
}

@customElement("eomap-folderfield")
export class Folderfield extends LitElement {
  static get styles() {
    return css`
      .container {
        display: flex;
        vertical-align: top;
        flex-wrap: wrap;
      }
      eomap-folder-textfield {
        --spectrum-textfield-texticon-min-width: var(
          --spectrum-folderfield-min-width,
          var(--spectrum-global-dimension-size-600)
        );
      }
    `;
  }
  @query("eomap-folder-textfield")
  textfield;

  @property({ type: String })
  label = "";

  @property({ type: String })
  placeholder = "";

  @property({ type: Boolean })
  invalid = false;

  @property({ type: FileSystemProvider })
  fileSystemProvider = null;

  @property({ type: FileSystemHandle })
  selected = null;

  render() {
    return html`
      <sp-field-label for="textfield" @click=${this.labelClick}
        >${this.label}</sp-field-label
      >
      <div class="container">
        <eomap-folder-textfield
          id="textfield"
          readonly
          .placeholder=${this.placeholder}
          .valid=${!this.invalid}
          .invalid=${this.invalid}
          @click=${this.select}
        ></eomap-folder-textfield>
        <sp-action-button
          quiet
          .disabled=${!this.selected}
          @click=${this.remove}
        >
          <sp-icon slot="icon">${CloseIcon()}</sp-icon>
        </sp-action-button>
      </div>
    `;
  }

  updated(changed) {
    if (changed.has("selected")) {
      if (this.selected) {
        this.textfield.value = `${this.selected.path}`;
      } else {
        this.textfield.value = "";
      }
    }
  }

  labelClick(_event) {
    this.textfield.hideFocusRing = false;
  }

  async select(_event) {
    try {
      this.selected = await this.fileSystemProvider.showDirectoryPicker();
      this.invalid = false;
    } catch (e) {
      if (e.name !== "AbortError") {
        throw e;
      }
    }
    document.activeElement.blur();
  }

  remove(_event) {
    this.selected = null;
  }
}
