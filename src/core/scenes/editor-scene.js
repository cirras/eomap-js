import { DrawCommand } from "../command/draw-command";
import { FillCommand } from "../command/fill-command";
import { TilePosState } from "../state/tilepos-state";
import { EvictingTextureCache } from "../gfx/texture-cache";

import { DrawTool } from "../tools/draw-tool";
import { EraseTool } from "../tools/erase-tool";
import { EyedropperTool } from "../tools/eyedropper-tool";
import { MoveTool } from "../tools/move-tool";
import { ZoomTool } from "../tools/zoom-tool";
import { FillTool } from "../tools/fill-tool";
import { EntityTool } from "../tools/entity-tool";

import "../gameobjects/eomap";
import "../gameobjects/cursor";

import { EntityState } from "../state/entity-state";
import { EntityCommand } from "../command/entity-command";
import { MapPropertiesState } from "../state/map-properties-state";
import { PropertiesCommand } from "../command/properties-command";
import { isMac } from "../util/platform-utils";

const Axis = {
  X: 0,
  Y: 1,
};

class AxisLock {
  constructor(x, y) {
    this.origin = { x, y };
    this.axis = null;
  }
}

export class EditorScene extends Phaser.Scene {
  constructor(gfxLoader) {
    super("editor");
    this.gfxLoader = gfxLoader;

    this.spacebarDown = false;
    this.currentPosDirty = false;

    this.currentPos = null;
    this.textureCache = null;
    this.map = null;
    this.tools = null;
    this.overrideTool = null;
    this.cursor = null;
    this.cameraControls = null;
    this.shiftKey = null;
    this.axisLock = null;
    this.copiedEntities = null;

    this._tempMatrix1 = new Phaser.GameObjects.Components.TransformMatrix();
    this._tempMatrix2 = new Phaser.GameObjects.Components.TransformMatrix();
  }

  create() {
    this.currentPos = new TilePosState();
    this.cursorPos = new TilePosState();

    this.textureCache = new EvictingTextureCache(
      this,
      this.gfxLoader,
      1024,
      1024,
    );

    this.cursor = this.add.cursor(this, this.textureCache).setDepth(1.0);

    // Preload the cursor in the texture cache
    this.textureCache.update();

    this.map = this.add.eomap(
      this,
      this.textureCache,
      this.emf,
      this.layerVisibility,
    );

    this.mapState.gameObject = this.map;

    this.tools = this.createTools();

    let cursorKeys = this.input.keyboard.createCursorKeys();
    this.cameraControls = new Phaser.Cameras.Controls.FixedKeyControl({
      camera: this.map.camera,
      left: cursorKeys.left,
      right: cursorKeys.right,
      up: cursorKeys.up,
      down: cursorKeys.down,
      speed: 1,
    });

    this.shiftKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
      false,
    );

    this.shiftKey.on("up", (_event) => {
      this.axisLock = null;
    });

    this.input.on("pointermove", (pointer) => this.handlePointerMove(pointer));
    this.input.on("pointerdown", (pointer) => this.handlePointerDown(pointer));
    this.input.on("pointerup", (pointer) => this.handlePointerUp(pointer));
    this.input.on("pointerupoutside", (pointer) =>
      this.handlePointerUp(pointer),
    );

    this.setupWorkaroundPointerEvents();
    this.setupWorkaroundKeyboardEvents();

    this.data.set("eyedrop", null);

    this.data.events.on("changedata-layerVisibility", () => {
      this.updateLayerVisibility();
    });

    this.data.events.on("changedata-selectedLayer", () => {
      this.updateSelectedLayer();
    });

    this.data.events.on("changedata-entityState", () => {
      this.updateEntityState();
    });

    this.data.events.on("changedata-mapPropertiesState", () => {
      this.updateMapPropertiesState();
    });

    this.data.events.on("changedata-updateZoom", () => {
      this.map.zoom = Math.min(
        ZoomTool.MAX_ZOOM,
        Math.max(ZoomTool.MIN_ZOOM, this.data.values.updateZoom),
      );
    });

    this.scale.on("resize", this.resize, this);

    this.updateLayerVisibility();
    this.updateSelectedLayer();
    this.resize();

    this.initCameraPosition();
  }

  createTools() {
    return new Map([
      ["draw", new DrawTool()],
      ["erase", new EraseTool()],
      ["eyedropper", new EyedropperTool()],
      ["move", new MoveTool()],
      ["zoom", new ZoomTool()],
      ["fill", new FillTool()],
      ["entity", new EntityTool()],
    ]);
  }

  setupWorkaroundPointerEvents() {
    // We have to sidestep the Phaser input manager here, because it only deals
    // in terms of MouseEvents and TouchEvents.
    //
    // MouseEvents don't have a `pointerId`, which we need for pointer-capture
    // purposes.
    //
    // Frustratingly, there's even a `pointerId` field on the phaser `Pointer`
    // interface, but this is null most of the time because it's only set by
    // TouchStart events.
    this.lastPointerDownId = null;
    this.lastPointerUpId = null;

    const onPointerDown = (event) => {
      this.lastPointerDownId = event.pointerId;
    };

    const onPointerUp = (event) => {
      this.lastPointerUpId = event.pointerId;
    };

    const onLostPointerCapture = (event) => {
      this.handleLostPointerCapture(event);
    };

    const target = this.input.manager.canvas;
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("pointerup", onPointerUp);
    target.addEventListener("lostpointercapture", onLostPointerCapture);

    this.sys.events.once("destroy", () => {
      target.removeEventListener("pointerdown", onPointerDown);
      target.removeEventListener("pointerup", onPointerUp);
      target.removeEventListener("lostpointercapture", onLostPointerCapture);
    });
  }

  setupWorkaroundKeyboardEvents() {
    // We have to sidestep the Phaser input manager here, because it ignores
    // keyboard events that had `preventDefault()` called on them.
    //
    // This happens for spacebar keyboard events when an action button on the
    // sidebar or palette has focus.
    this.onKeyDown = (event) => {
      if (event.code === "Space") {
        this.spacebarDown = true;
      }
    };

    this.onKeyUp = (event) => {
      if (event.code === "Space") {
        this.spacebarDown = false;
      }
    };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.sys.events.once("destroy", () => {
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
    });
  }

  update(time, delta) {
    this.cameraControls.update(delta);
    this.textureCache.update();

    if (this.map.camera.dirty) {
      this.mapState.scrollX = this.map.scrollX;
      this.mapState.scrollY = this.map.scrollY;
      if (this.mapState.zoom !== this.map.zoom) {
        this.mapState.zoom = this.map.zoom;
        this.events.emit("zoom-changed");
      }
      if (this.cursorPos.valid) {
        this.positionCursor();
      }
    }

    this.map.update(time, delta);

    this.render.shouldRender =
      this.map.shouldRender || this.cursor.shouldRender || this.currentPosDirty;

    if (this.currentPosDirty) {
      this.data.set("currentPos", this.currentPos);
      this.currentPosDirty = false;
    }
  }

  resize() {
    this.map.setSize(this.cameras.main.width + 1, this.cameras.main.height + 1);
  }

  moveCursor(tilePos) {
    if (this.cursorPos.x === tilePos.x && this.cursorPos.y === tilePos.y) {
      return;
    }

    this.cursorPos = tilePos;
    this.cursor.visible = this.cursorPos.valid;

    if (this.cursorPos.valid) {
      this.positionCursor();
    }

    return this.cursorPos.valid;
  }

  positionCursor() {
    let x = this.cursorPos.x * 32 - this.cursorPos.y * 32;
    let y = this.cursorPos.x * 16 + this.cursorPos.y * 16;

    let camera = this.map.camera;

    let cameraDirty = camera.dirty;
    camera.preRender();
    camera.dirty = cameraDirty;

    let camMatrix = this._tempMatrix1;
    camMatrix.copyFrom(camera.matrix);

    let spriteMatrix = this._tempMatrix2;
    spriteMatrix.applyITRS(x, y, 0, 1, 1);
    spriteMatrix.e -= camera.scrollX;
    spriteMatrix.f -= camera.scrollY;

    camMatrix.multiply(spriteMatrix);

    this.cursor
      .setScale(this.map.zoom)
      .setPosition(Math.round(camMatrix.e), Math.round(camMatrix.f));
  }

  handlePointerMove(pointer) {
    this.updateOverrideTool(pointer);
    this.tool.pointerMove(this, pointer);
    this.updateIsToolBeingUsed();
  }

  handlePointerDown(pointer) {
    this.updateOverrideTool(pointer);
    this.tool.pointerDown(this, pointer);
    this.updateIsToolBeingUsed();
  }

  handlePointerUp(pointer) {
    this.tool.pointerUp(this, pointer);
    this.updateOverrideTool(pointer);
    this.updateIsToolBeingUsed();
  }

  handleLostPointerCapture(_event) {
    this.tool.lostPointerCapture(this);
  }

  setPointerCapture() {
    const target = this.input.manager.canvas;
    try {
      target.setPointerCapture(this.lastPointerDownId);
    } catch (e) {
      console.error("setPointerCapture failed", {
        pointerId: this.lastPointerDownId,
        error: e,
      });
    }
  }

  releasePointerCapture() {
    const target = this.input.manager.canvas;
    try {
      target.releasePointerCapture(this.lastPointerUpId);
    } catch (e) {
      console.error("releasePointerCapture failed", {
        pointerId: this.lastPointerUpId,
        error: e,
      });
    }
  }

  canDraw(drawID) {
    if (drawID === 0 && this.selectedLayer !== 0 && this.selectedLayer !== 9) {
      return false;
    }
    return drawID !== null;
  }

  getDrawPos() {
    let x = this.currentPos.x;
    let y = this.currentPos.y;

    if (this.shiftKey.isDown) {
      if (this.axisLock === null) {
        this.axisLock = new AxisLock(x, y);
      }

      let origin = this.axisLock.origin;

      if (this.axisLock.axis === null && !(origin.x === x && origin.y === y)) {
        this.axisLock.axis = x === origin.x ? Axis.Y : Axis.X;
      }

      switch (this.axisLock.axis) {
        case Axis.X:
          y = origin.y;
          break;
        case Axis.Y:
          x = origin.x;
          break;
        default:
        // do nothing
      }
    }

    return { x, y };
  }

  doDrawCommand(drawID) {
    if (!this.canDraw(drawID)) {
      return;
    }

    let pos = this.getDrawPos();
    let oldDrawID = this.map.getDrawID(pos.x, pos.y, this.selectedLayer);

    if (drawID === oldDrawID) {
      return;
    }

    this.commandInvoker.add(
      new DrawCommand(
        this.mapState,
        pos.x,
        pos.y,
        this.selectedLayer,
        oldDrawID,
        drawID,
      ),
      true,
    );
  }

  doFillCommand(drawID) {
    if (!this.canDraw(drawID)) {
      return;
    }

    let pos = this.currentPos;
    let oldDrawID = this.map.getDrawID(pos.x, pos.y, this.selectedLayer);

    if (drawID === oldDrawID) {
      return;
    }

    this.commandInvoker.add(
      new FillCommand(
        this.mapState,
        pos.x,
        pos.y,
        this.selectedLayer,
        oldDrawID,
        drawID,
      ),
    );
  }

  doEraseCommand() {
    let pos = this.getDrawPos();
    let drawID = this.selectedLayer === 0 ? 0 : null;
    let oldDrawID = this.map.getDrawID(pos.x, pos.y, this.selectedLayer);

    if (drawID === oldDrawID) {
      return;
    }

    this.commandInvoker.add(
      new DrawCommand(
        this.mapState,
        pos.x,
        pos.y,
        this.selectedLayer,
        oldDrawID,
        drawID,
      ),
      true,
    );
  }

  finalizeDraw() {
    this.commandInvoker.finalizeAggregate();
    this.axisLock = null;
  }

  updateOverrideTool(pointer) {
    if (this.tool.isBeingUsed) {
      return;
    }

    if (pointer.middleButtonDown() || this.spacebarDown) {
      this.overrideTool = "move";
    } else if (isMac() ? pointer.event.metaKey : pointer.event.ctrlKey) {
      this.overrideTool = "eyedropper";
    } else {
      this.overrideTool = null;
    }
  }

  updateIsToolBeingUsed() {
    this.data.set("isToolBeingUsed", this.tool.isBeingUsed);
  }

  updateCurrentPos(pointerPos) {
    let worldPos = this.map.camera.getWorldPoint(pointerPos.x, pointerPos.y);
    let newPos = this.getTilePosFromWorldPos(worldPos);

    if (this.currentPos.x !== newPos.x || this.currentPos.y !== newPos.y) {
      this.currentPosDirty = true;
      this.currentPos = newPos;
    }
  }

  updateLayerVisibility() {
    this.map.setLayerVisibility(this.layerVisibility);
  }

  updateSelectedLayer() {
    this.map.setSelectedLayer(this.selectedLayer);
  }

  updateEntityState(newEntityState) {
    if (newEntityState === undefined) {
      newEntityState = this.data.get("entityState");
    }

    let x = newEntityState.x;
    let y = newEntityState.y;

    let oldEntityState = new EntityState(
      x,
      y,
      this.map.getWarp(x, y),
      this.map.getSign(x, y),
      this.map.getNPCs(x, y),
      this.map.getItems(x, y),
    );

    this.commandInvoker.add(
      new EntityCommand(this.mapState, x, y, oldEntityState, newEntityState),
    );
  }

  updateMapPropertiesState() {
    let newMapPropertiesState = this.data.get("mapPropertiesState");

    let oldMapPropertiesState = new MapPropertiesState(
      this.emf.name,
      this.emf.width,
      this.emf.height,
      this.emf.type,
      this.emf.effect,
      this.emf.mapAvailable,
      this.emf.canScroll,
      this.emf.musicID,
      this.emf.ambientSoundID,
      this.emf.musicControl,
      this.emf.relogX,
      this.emf.relogY,
    );

    this.commandInvoker.add(
      new PropertiesCommand(
        this.mapState,
        oldMapPropertiesState,
        newMapPropertiesState,
      ),
    );
  }

  requestContextMenu(contextMenuState) {
    this.events.emit("request-context-menu", contextMenuState);
  }

  getTilePosFromPointerPos(pointerPos) {
    let worldPos = this.map.camera.getWorldPoint(pointerPos.x, pointerPos.y);

    return this.getTilePosFromWorldPos(worldPos);
  }

  getTilePosFromWorldPos(worldPos) {
    let tilePos = new TilePosState();
    tilePos.x = this.getTileXFromWorldPos(worldPos);
    tilePos.y = this.getTileYFromWorldPos(worldPos);

    tilePos.valid =
      tilePos.x >= 0 &&
      tilePos.x < this.emf.width &&
      tilePos.y >= 0 &&
      tilePos.y < this.emf.height;

    return tilePos;
  }

  getTileXFromWorldPos(worldPos) {
    return Math.floor(worldPos.y / 32 + (worldPos.x + 32) / 64) - 1;
  }

  getTileYFromWorldPos(worldPos) {
    return -Math.floor((worldPos.x + 32) / 64 - worldPos.y / 32);
  }

  initCameraPosition() {
    this.map.scrollX = this.mapState.scrollX || -this.map.camera.centerX + 32;
    this.map.scrollY = this.mapState.scrollY || -64;
    this.map.zoom = this.mapState.zoom || 1.0;
  }

  get tool() {
    return this.tools.get(this.overrideTool || this.selectedTool);
  }

  get emf() {
    return this.mapState.emf;
  }

  get commandInvoker() {
    return this.mapState.commandInvoker;
  }

  get mapState() {
    return this.data.get("mapState");
  }

  get selectedTool() {
    return this.data.get("selectedTool");
  }

  get selectedLayer() {
    return this.data.get("selectedLayer");
  }

  get selectedDrawID() {
    return this.data.get("selectedDrawID");
  }

  get layerVisibility() {
    return this.data.get("layerVisibility");
  }
}
