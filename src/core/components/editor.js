import { css, html } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import "phaser";
import { EditorScene } from "../scenes/editor-scene";

import "./context-menu";
import { PhaserInstance } from "./phaser-instance";

import { EntityState } from "../state/entity-state";
import { MapPropertiesState } from "../state/map-properties-state";
import { MapState } from "../state/map-state";
import { GFXLoader } from "../gfx/load/gfx-loader";

@customElement("eomap-editor")
export class Editor extends PhaserInstance {
  static get styles() {
    return [
      super.styles,
      css`
        :host {
          overflow: hidden;
          display: grid;
          grid-template-rows: 100%;
          grid-template-columns: 100%;
        }
      `,
    ];
  }

  @query("eomap-context-menu")
  contextMenu;

  @property({ type: GFXLoader })
  gfxLoader;

  @property({ type: MapState })
  mapState;

  @property({ type: String })
  selectedTool;

  @property({ type: Array })
  layerVisibility;

  @property({ type: Number })
  selectedLayer;

  @property({ type: Number })
  selectedDrawID;

  @property({ type: EntityState })
  entityState;

  @property({ type: MapPropertiesState })
  mapPropertiesState;

  updateZoom = () => {
    // do nothing
  };

  setupEntityToolEvents(scene) {
    scene.events.on("request-entity-editor", (entityState) => {
      this.dispatchEvent(
        new CustomEvent("request-entity-editor", { detail: entityState }),
      );
    });
  }

  setupContextMenuEvents(scene) {
    scene.events.on("request-context-menu", (contextMenuState) => {
      this.contextMenu.state = contextMenuState;
      this.contextMenu.open = true;
      this.requestUpdate();
    });
  }

  setupZoomEvents(scene) {
    scene.data.set("updateZoom", this.mapState.zoom);
    this.updateZoom = (zoom) => {
      scene.data.set("updateZoom", zoom);
    };
    scene.events.on("zoom-changed", () => {
      this.dispatchEvent(new CustomEvent("zoom-changed"));
    });
  }

  updated(changedProperties) {
    super.updated(changedProperties);

    if (changedProperties.has("mapState")) {
      this.destroyPhaser();
      if (this.mapState.loaded) {
        this.setupPhaser();
      }
    }
  }

  render() {
    return html`
      ${super.render()}
      <eomap-context-menu></eomap-context-menu>
    `;
  }

  createScene() {
    return new EditorScene(this.gfxLoader);
  }

  onSceneReady(scene) {
    this.setupEntityToolEvents(scene);
    this.setupContextMenuEvents(scene);
    this.setupZoomEvents(scene);
  }

  get phaserDataKeys() {
    return ["currentPos", "eyedrop", "isToolBeingUsed"];
  }

  get componentDataKeys() {
    return [
      "mapState",
      "selectedTool",
      "layerVisibility",
      "selectedLayer",
      "selectedDrawID",
      "entityState",
      "mapPropertiesState",
    ];
  }
}
