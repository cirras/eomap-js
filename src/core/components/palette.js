import { css, html } from "lit";
import {
  customElement,
  eventOptions,
  property,
  query,
  state,
} from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import "@spectrum-web-components/action-button/sp-action-button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@spectrum-web-components/icons-workflow";

import "./action-group";
import "./sidebar-button";
import { PhaserInstance } from "./phaser-instance";

import "phaser";
import { PaletteScene } from "../scenes/palette-scene";

import { Eyedrop } from "../tools/eyedrop";

import { merge } from "../util/object-utils";

import scrollbarStyles from "../styles/scrollbar";

@customElement("eomap-palette")
export class Palette extends PhaserInstance {
  static DEFAULT_WIDTH = 351;
  static MIN_WIDTH = 159;

  static get styles() {
    return [
      super.styles,
      scrollbarStyles,
      css`
        :host {
          position: relative;
          display: grid;
          grid-template-rows: min-content minmax(0, 1fr);
          background-color: var(--spectrum-global-color-gray-400);
          --palette-gutter-width: 4px;
          --palette-gutter-handle-width: calc(var(--palette-gutter-width) * 2);
        }
        @media (pointer: coarse) {
          :host {
            --palette-gutter-handle-width: calc(
              var(--palette-gutter-width) * 4
            );
          }
        }
        .palette-gutter {
          position: absolute;
          top: 0px;
          left: calc(1px - var(--palette-gutter-width));
          bottom: 0px;
          width: var(--palette-gutter-width);
          touch-action: none;
          pointer-events: none;
          z-index: 1000;
          transition-property: background;
        }
        .palette-gutter-handle {
          position: absolute;
          top: 0px;
          left: calc(var(--palette-gutter-handle-width) / -2);
          bottom: 0px;
          width: var(--palette-gutter-handle-width);
          touch-action: none;
          cursor: ew-resize;
          z-index: 999;
        }
        .palette-gutter-hover {
          background: var(--spectrum-alias-focus-color);
          transition-duration: 0.3s;
          transition-delay: 0.3s;
        }
        .palette-gutter-active {
          background: var(--spectrum-alias-focus-color);
        }
        .palette-header {
          display: grid;
          place-self: center;
          grid-template-columns: min-content minmax(0, 1fr) min-content;
          padding-top: var(--spectrum-global-dimension-size-100);
          padding-bottom: var(--spectrum-global-dimension-size-100);
        }
        #palette-scroll-container {
          width: auto;
          height: auto;
          padding: var(--spectrum-global-dimension-size-50);
          margin-left: var(--spectrum-global-dimension-size-50);
          margin-right: var(--spectrum-global-dimension-size-50);
          margin-bottom: var(--spectrum-global-dimension-size-50);
          background-color: var(--spectrum-global-color-gray-75);
          overflow-y: scroll;
        }
        #palette-scroll-container:focus-visible {
          outline: unset;
        }
        .palette-viewport {
          width: 100%;
          position: -webkit-sticky;
          position: sticky;
          top: 0;
        }
        .scroll-arrow {
          --spectrum-actionbutton-m-quiet-textonly-background-color: var(
            --spectrum-global-color-gray-400
          );
          --spectrum-actionbutton-m-quiet-textonly-background-color-down: var(
            --spectrum-global-color-gray-400
          );
          --spectrum-actionbutton-m-texticon-icon-color-disabled: var(
            --spectrum-global-color-gray-300
          );
        }
        #layer-buttons {
          display: flex;
          padding: 1px;
          flex-wrap: nowrap;
          overflow-x: scroll;
          overflow: -moz-scrollbars-none;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        #layer-buttons::-webkit-scrollbar {
          width: 0 !important;
          display: none;
        }
        #layer-buttons sp-action-button::after {
          border-radius: unset;
        }
        #layer-buttons sp-action-button:first-of-type::after {
          border-top-left-radius: var(--spectrum-alias-component-border-radius);
          border-bottom-left-radius: var(
            --spectrum-alias-component-border-radius
          );
        }
        #layer-buttons sp-action-button:last-of-type::after {
          border-top-right-radius: var(
            --spectrum-alias-component-border-radius
          );
          border-bottom-right-radius: var(
            --spectrum-alias-component-border-radius
          );
        }
        sp-action-button {
          --spectrum-actionbutton-m-textonly-background-color: var(
            --spectrum-global-color-gray-400
          );
          --spectrum-actionbutton-m-textonly-border-color: var(
            --spectrum-global-color-gray-300
          );
          --spectrum-actionbutton-m-textonly-background-color-hover: var(
            --spectrum-global-color-gray-400
          );
          --spectrum-actionbutton-m-textonly-border-color-hover: var(
            --spectrum-global-color-gray-300
          );
          --spectrum-actionbutton-m-textonly-background-color-key-focus: var(
            --spectrum-global-color-gray-400
          );
          --spectrum-actionbutton-m-textonly-background-color-down: var(
            --spectrum-global-color-gray-300
          );
          --spectrum-actionbutton-m-textonly-border-color-down: var(
            --spectrum-global-color-gray-300
          );
          --spectrum-actionbutton-m-textonly-border-color-selected: var(
            --spectrum-global-color-gray-300
          );
          --spectrum-actionbutton-m-textonly-border-color-selected-hover: var(
            --spectrum-global-color-gray-300
          );
          --spectrum-actionbutton-m-textonly-border-color-selected-down: var(
            --spectrum-global-color-gray-300
          );
        }
        sp-action-button:focus-visible {
          --spectrum-actionbutton-m-textonly-border-color-selected-hover: var(
            --spectrum-alias-component-border-color-selected-key-focus
          );
          --spectrum-actionbutton-m-textonly-border-color-down: var(
            --spectrum-alias-component-border-color-selected-key-focus
          );
          --spectrum-actionbutton-m-textonly-border-color-selected-down: var(
            --spectrum-alias-component-border-color-selected-key-focus
          );
        }
        sp-action-button[quiet]:focus-visible {
          --spectrum-actionbutton-m-quiet-textonly-border-color-selected-hover: var(
            --spectrum-alias-component-border-color-quiet-selected-key-focus
          );
          --spectrum-actionbutton-m-quiet-textonly-border-color-down: var(
            --spectrum-alias-component-border-color-quiet-selected-key-focus
          );
          --spectrum-actionbutton-m-quiet-textonly-border-color-selected-down: var(
            --spectrum-alias-component-border-color-quiet-selected-key-focus
          );
        }
      `,
    ];
  }

  @query("#layer-buttons", true)
  layerButtonsGroup;

  @query("#palette-scroll-container", true)
  paletteScrollContainer;

  @query("#palette-content", true)
  paletteContent;

  @property({ type: Number })
  selectedLayer;

  @property({ type: Number })
  selectedDrawID;

  @property({ type: Eyedrop })
  eyedrop = null;

  @property({ type: Boolean })
  pointerEnabled = true;

  @property({ type: Number })
  maxWidth = Palette.MIN_WIDTH;

  @state({ type: Number })
  width = Palette.DEFAULT_WIDTH;

  @state({ type: Boolean })
  leftArrowEnabled = false;

  @state({ type: Boolean })
  rightArrowEnabled = false;

  @state({ type: Boolean })
  gutterHover = false;

  @state({ type: Boolean })
  gutterActive = false;

  @state({ type: Number })
  viewportHeight;

  @state({ type: Number })
  contentHeight = 0;

  @state({ type: Function })
  onPaletteContentScroll = null;

  headerScrolling = false;
  headerScrollStartTimestamp = null;

  gutterTouch = false;

  scrollContainerResizeObserver = new ResizeObserver((_entries) => {
    this.updateViewportHeight();
  });

  async firstUpdated(changes) {
    super.firstUpdated(changes);

    const children = this.shadowRoot.querySelectorAll("*");
    await Promise.all(Array.from(children).map((c) => c.updateComplete));

    this.scrollContainerResizeObserver.observe(this.paletteScrollContainer);
    this.checkLayerButtonsArrows();
    this.updateViewportHeight();
  }

  setupContentHeightListener(scene) {
    scene.events.on("contentHeight-changed", (value) => {
      if (value !== this.contentHeight) {
        this.contentHeight = value;
        // The paletteContent height needs an immediate update, or
        // paletteScrollContainer.scrollTop will get clamped to the previous
        // content height when switching layers.
        this.paletteContent.style.height = `${value}px`;
      }
    });
  }

  setupContentScrollMirroring(scene) {
    scene.data.set("contentScroll", 0);
    this.onPaletteContentScroll = () => {
      scene.data.set("contentScroll", this.paletteScrollContainer.scrollTop);
    };

    scene.events.on("scroll-changed", (value, previousValue) => {
      if (value !== previousValue) {
        this.paletteScrollContainer.scrollTop = value;
      }
      this.onPaletteContentScroll();
    });
  }

  shouldUpdate(changedProperties) {
    if (changedProperties.length === 1 && changedProperties.has("maxWidth")) {
      return this.width !== this.calcWidth();
    }
    return true;
  }

  updated(changedProperties) {
    super.updated(changedProperties);

    if (changedProperties.has("gfxLoader")) {
      this.destroyPhaser();
      if (this.gfxLoader && this.gfxErrors === 0) {
        this.setupPhaser();
      }
    }

    if (changedProperties.has("width")) {
      this.checkLayerButtonsArrows();
    }
  }

  renderLayerButtons() {
    const LAYER_NAMES = [
      "Ground",
      "Objects",
      "Overlay",
      "Down Wall",
      "Right Wall",
      "Roof",
      "Top",
      "Shadow",
      "Overlay 2",
      "Special",
    ];

    return LAYER_NAMES.map((label, i) => {
      return html`
        <sp-action-button
          value="${i}"
          tabindex="0"
          ?selected=${this.selectedLayer === i}
          @click=${this.onLayerClick}
        >
          ${label}
        </sp-action-button>
      `;
    });
  }

  calcWidth() {
    return Math.min(this.maxWidth, Math.max(this.width, Palette.MIN_WIDTH));
  }

  renderGutter() {
    const gutterClasses = {
      "palette-gutter-hover": this.gutterHover,
      "palette-gutter-active": this.gutterActive,
    };

    return html`
      <div class="palette-gutter ${classMap(gutterClasses)}"></div>
      <div
        class="palette-gutter-handle"
        @pointerdown=${this.onGutterPointerDown}
        @mouseover=${this.gutterMouseOver}
        @mouseout=${this.gutterMouseOut}
        @touchstart=${this.gutterTouchStart}
        @touchend=${this.gutterTouchEnd}
        @touchcancel=${this.gutterTouchCancel}
      ></div>
    `;
  }

  gutterMouseOver(_event) {
    this.gutterHover = !this.gutterTouch;
  }

  gutterMouseOut(_event) {
    this.gutterHover = false;
  }

  @eventOptions({ passive: true })
  gutterTouchStart(_event) {
    this.gutterHover = false;
    this.gutterTouch = true;
  }

  gutterTouchEnd(event) {
    event.preventDefault();
    this.gutterTouch = false;
  }

  gutterTouchCancel(_event) {
    this.gutterTouch = false;
  }

  render() {
    return html`
      <style>
        :host {
          width: ${this.calcWidth()}px;
        }
      </style>
      ${this.renderGutter()}
      <div class="palette-header">
        <sp-action-button
          class="scroll-arrow"
          quiet
          ?disabled=${!this.leftArrowEnabled}
          @pointerdown=${this.onLeftArrowPointerDown}
          @pointerup=${this.onArrowPointerUp}
          @pointerout=${this.onArrowPointerUp}
        >
          <sp-icon slot="icon">${ChevronLeftIcon()}</sp-icon">
        </sp-action-button>
        <div 
          tabindex="-1"
          id="layer-buttons"
          @scroll=${this.onLayerButtonsScroll}
        >
          <eomap-action-group compact>
            ${this.renderLayerButtons()}
          </eomap-action-group>
        </div>
        <sp-action-button
          class="scroll-arrow"
          quiet
          ?disabled=${!this.rightArrowEnabled}
          @pointerdown=${this.onRightArrowPointerDown}
          @pointerup=${this.onArrowPointerUp}
          @pointerout=${this.onArrowPointerUp}
        >
          <sp-icon slot="icon">${ChevronRightIcon()}</sp-icon">
        </sp-action-button>
      </div>
      <div
        id="palette-scroll-container"
        tabindex="-1"
        @scroll=${this.onPaletteContentScroll}
      >
        <div id="palette-content" style="width: 100%; height: ${
          this.contentHeight
        }px">
          <div class="palette-viewport" style="height: ${
            this.viewportHeight
          }px">
            ${super.render()}
          </div>
        </div>
      </div>
    `;
  }

  updateViewportHeight() {
    let container = this.paletteScrollContainer;
    if (container) {
      let style = getComputedStyle(container);
      this.viewportHeight =
        container.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
    }
  }

  onGutterPointerDown(event) {
    const gutter = event.target;
    gutter.setPointerCapture(event.pointerId);

    this.gutterActive = true;

    const oldWidth = this.calcWidth();
    const oldX = event.x;

    let onPointerMove = (moveEvent) => {
      this.width = oldWidth + oldX - moveEvent.x;
      moveEvent.preventDefault();
    };

    let onPointerUp = (_event) => {
      gutter.releasePointerCapture(event.pointerId);
    };

    let onLostPointerCapture = (_event) => {
      this.gutterActive = false;
      this.width = this.calcWidth();
      this.dispatchEvent(new CustomEvent("resize-end"));
      gutter.removeEventListener("pointermove", onPointerMove);
      gutter.removeEventListener("pointerup", onPointerUp);
      gutter.removeEventListener("lostpointercapture", onLostPointerCapture);
    };

    gutter.addEventListener("pointermove", onPointerMove);
    gutter.addEventListener("pointerup", onPointerUp);
    gutter.addEventListener("lostpointercapture", onLostPointerCapture);

    this.dispatchEvent(new CustomEvent("resize-start"));
  }

  onLeftArrowPointerDown() {
    this.onArrowPointerDown(-1);
  }

  onRightArrowPointerDown() {
    this.onArrowPointerDown(1);
  }

  onArrowPointerDown(direction) {
    this.scrollingHeader = true;
    let startValue = this.layerButtonsGroup.scrollLeft;
    requestAnimationFrame((timestamp) => {
      this.scrollHeader(timestamp, startValue, direction);
    });
  }

  onArrowPointerUp() {
    this.scrollingHeader = false;
    this.headerScrollStartTimestamp = null;
  }

  scrollHeader(timestamp, startValue, direction) {
    if (this.scrollingHeader) {
      if (this.headerScrollStartTimestamp == null) {
        this.headerScrollStartTimestamp = timestamp;
      }

      let delta = timestamp - this.headerScrollStartTimestamp;
      let scrollValue = startValue + (delta / 2) * direction;
      this.layerButtonsGroup.scrollLeft = scrollValue;

      requestAnimationFrame((t) => this.scrollHeader(t, startValue, direction));
    }
  }

  onLayerButtonsScroll(_event) {
    this.checkLayerButtonsArrows();
  }

  checkLayerButtonsArrows() {
    let element = this.layerButtonsGroup;
    this.leftArrowEnabled = element.scrollLeft > 0;
    this.rightArrowEnabled =
      element.scrollLeft + element.offsetWidth !== element.scrollWidth;
  }

  onLayerClick(event) {
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent("layer-selected", {
        detail: parseInt(event.target.value),
      }),
    );
  }

  createScene() {
    return new PaletteScene(this.gfxLoader);
  }

  onSceneReady(scene) {
    this.setupContentHeightListener(scene);
    this.setupContentScrollMirroring(scene);
    this.updateViewportHeight();
  }

  get config() {
    return merge(super.config, {
      render: {
        transparent: true,
      },
      input: {
        keyboard: false,
      },
    });
  }

  get phaserDataKeys() {
    return ["selectedDrawID"];
  }

  get componentDataKeys() {
    return ["selectedLayer", "eyedrop"];
  }
}
