import {
  PaletteLayerResourceEntry,
  PaletteLayerSpecEntry,
  PaletteLayerBlackTileEntry,
} from "../gameobjects/palette-layer";
import { TextureCache } from "../gfx/texture-cache";

class LayerPreload {
  static PRELOAD_PER_FRAME = 5;

  constructor(layer) {
    this.layer = layer;
    this.preloadEntries = Array.from(this.layer.entries.values());
  }

  update() {
    let pending = this.layer.scene.textureCache.pending;
    let amount = 0;

    for (let resource of this.preloadEntries) {
      if (pending.length >= LayerPreload.PRELOAD_PER_FRAME) {
        break;
      }
      resource.preload();
      ++amount;
    }

    this.preloadEntries.splice(0, amount);
  }

  get finished() {
    return this.preloadEntries.length === 0;
  }
}

export class PaletteScene extends Phaser.Scene {
  static FILE_BY_LAYER = [3, 4, 5, 6, 6, 7, 3, 22, 5];

  constructor(gfxLoader) {
    super("palette");
    this.gfxLoader = gfxLoader;
    this.textureCache = null;
    this.selectedLayer = null;
    this.layers = [];
    this.preloads = [];
    this.lastResize = performance.now();
    this.dirtySelectedLayer = true;
    this.dirtySelectedEntry = true;
  }

  create() {
    this.textureCache = new TextureCache(this, this.gfxLoader, 2048, 2048);

    this.layers = this.createLayers();
    this.preloads = this.layers.map((layer) => new LayerPreload(layer));

    this.data.events.on(
      "changedata-selectedLayer",
      (_parent, value, _previousValue) => {
        this.selectLayer(value);
      },
    );

    this.data.events.on(
      "changedata-eyedrop",
      (_parent, value, _previousValue) => {
        this.selectEntry(value.drawID);
        let resource = this.selectedLayer.selectedEntry;
        if (resource) {
          this.selectedLayer.scroll = resource.y;
          this.emitScrollChangedEvent();
        }
        this.updateSelectedDrawID();
      },
    );

    this.data.events.on(
      "changedata-contentScroll",
      (_parent, value, _previousValue) => {
        this.cameras.main.scrollY = value;
        this.selectedLayer.scroll = value;
      },
    );

    this.input.on("pointerup", (pointer) => {
      if (pointer.leftButtonReleased() && pointer.getDistance() < 16) {
        let entry = this.selectedLayer.getEntryAtPosition(
          pointer.x,
          pointer.y + this.cameras.main.scrollY,
        );
        if (entry) {
          this.selectEntry(entry.id);
          this.updateSelectedDrawID();
        }
      }
    });

    this.scale.on("resize", this.resize, this);
    this.resize();

    this.selectLayer(this.data.values.selectedLayer);
  }

  createLayers() {
    let result = [];

    for (let fileID of PaletteScene.FILE_BY_LAYER) {
      result.push(this.createResourceLayer(fileID));
    }

    result.push(this.createSpecLayer());

    return result;
  }

  createResourceLayer(fileID) {
    let layer = this.add.paletteLayer(this);
    let resourceIDs = this.gfxLoader.resourceIDs(fileID);

    if (fileID === 3) {
      layer.addEntry(new PaletteLayerBlackTileEntry(this.textureCache));
    }

    for (let resourceID of resourceIDs) {
      if (resourceID < 101) {
        continue;
      }

      let info = this.gfxLoader.resourceInfo(fileID, resourceID);
      let width = info.width;
      let height = info.height;

      if (fileID === 3 || fileID === 7) {
        width = 64;
        height = 32;
      }

      if (fileID === 6 && width > 120) {
        width = Math.floor(width / 4);
      }

      let resource = new PaletteLayerResourceEntry(
        this.textureCache,
        width,
        height,
        fileID,
        resourceID,
      );

      layer.addEntry(resource);
    }

    return layer;
  }

  createSpecLayer() {
    let layer = this.add.paletteLayer(this);

    for (let tileSpec = 0; tileSpec < 37; ++tileSpec) {
      let spec = new PaletteLayerSpecEntry(this.textureCache, tileSpec);
      layer.addEntry(spec);
    }

    return layer;
  }

  selectLayer(layer) {
    if (this.selectedLayer) {
      this.syncFileScroll();
      this.selectedLayer.visible = false;
    }

    this.selectedLayer = this.layers[layer];
    this.selectedLayer.visible = true;
    this.dirtySelectedLayer = true;

    if (this.selectedLayer.dirtyLayout) {
      this.selectedLayer.layout();
    }
    this.prioritizePreloads();
    this.updateSelectedDrawID();
    this.emitContentHeightChangedEvent();
    this.emitScrollChangedEvent();
  }

  selectEntry(entryID) {
    this.selectedLayer.selectEntry(entryID);
    this.dirtySelectedEntry = true;
  }

  syncFileScroll() {
    let layerID = this.layers.indexOf(this.selectedLayer);
    let fileID = PaletteScene.FILE_BY_LAYER[layerID];
    for (let layer of this.getLayersByFile(fileID)) {
      layer.scroll = this.selectedLayer.scroll;
    }
  }

  getLayersByFile(fileID) {
    let layerIDs = [];
    switch (fileID) {
      case 3:
        layerIDs.push(0, 6);
        break;
      case 4:
        layerIDs.push(1);
        break;
      case 5:
        layerIDs.push(2, 8);
        break;
      case 6:
        layerIDs.push(3, 4);
        break;
      case 7:
        layerIDs.push(5);
        break;
      case 22:
        layerIDs.push(7);
        break;
    }
    return layerIDs.map((id) => this.layers[id]);
  }

  update(_time, _delta) {
    this.selectedLayer.update(_time, _delta);

    let dirtyLayout =
      this.selectedLayer.dirtyLayout && this.canDoResizeLayout();

    this.render.shouldRender =
      dirtyLayout ||
      this.dirtySelectedLayer ||
      this.dirtySelectedEntry ||
      this.cameras.main.dirty ||
      this.selectedLayer.dirtyAnimationFrame;

    this.dirtySelectedLayer = false;
    this.dirtySelectedEntry = false;

    if (dirtyLayout) {
      this.selectedLayer.layout();
      this.emitContentHeightChangedEvent();
    }

    if (this.preloads.length > 0) {
      let preload = this.preloads[0];
      preload.update();
      if (preload.finished) {
        this.preloads.shift();
      }
    }

    this.textureCache.update();
  }

  canDoResizeLayout() {
    return this.lastResize < performance.now() - 100;
  }

  resize(gameSize, _baseSize, _displaySize, _resolution) {
    let width;
    let height;

    if (gameSize === undefined) {
      width = this.sys.scale.width;
      height = this.sys.scale.height;
    } else {
      width = gameSize.width;
      height = gameSize.height;
    }

    for (let layer of this.layers) {
      layer.width = width;
    }

    this.cameras.main.setSize(width, height);
    this.lastResize = performance.now();
  }

  prioritizePreloads() {
    let preloads = this.preloads;
    for (let preload of preloads) {
      if (preload.layer === this.selectedLayer) {
        Phaser.Utils.Array.MoveTo(preloads, preload, 0);
        break;
      }
    }
  }

  emitContentHeightChangedEvent() {
    this.events.emit("contentHeight-changed", this.selectedLayer.height);
  }

  emitScrollChangedEvent() {
    this.events.emit(
      "scroll-changed",
      this.selectedLayer.scroll,
      this.data.values.contentScroll,
    );
  }

  updateSelectedDrawID() {
    let id = null;
    if (this.selectedLayer.selectedEntry) {
      id = this.selectedLayer.selectedEntry.id;
    }
    this.data.set("selectedDrawID", id);
  }
}
