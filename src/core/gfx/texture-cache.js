import ShelfPack from "@mapbox/shelf-pack";
import { AssetFactory } from "./asset";
import { DrawableMultiTexture } from "./drawable-multi-texture";
import { PendingPromise } from "../util/pending-promise";
import { isEmpty } from "../util/object-utils";
import { removeFirst } from "../util/array-utils";

class TextureCacheEntry {
  constructor(key, defaultAsset) {
    this.key = key;
    this.asset = defaultAsset;
    this.page = null;
    this.bin = null;
    this.refCount = 0;
    this.loadingCompletePromise = new PendingPromise();
  }

  incRef() {
    ++this.refCount;
  }

  decRef() {
    if (this.refCount === 0) {
      throw new Error("Negative refCount");
    }

    --this.refCount;
  }

  get loadingComplete() {
    return this.loadingCompletePromise?.promise ?? null;
  }
}

class ResourceTextureCacheEntry extends TextureCacheEntry {
  constructor(key, defaultAsset, fileID, resourceID) {
    super(key, defaultAsset);
    this.fileID = fileID;
    this.resourceID = resourceID;
  }

  createAsset(assetFactory, textureKey) {
    return assetFactory.createResource(
      textureKey,
      this.key,
      this.fileID,
      this.resourceID,
    );
  }

  async loadGFX(gfxLoader) {
    return gfxLoader.loadResource(this.fileID, this.resourceID);
  }
}

class SpecTextureCacheEntry extends TextureCacheEntry {
  constructor(key, defaultAsset, tileSpec) {
    super(key, defaultAsset);
    this.tileSpec = tileSpec;
  }

  createAsset(assetFactory, textureKey) {
    return assetFactory.createRaw(textureKey, this.key);
  }

  async loadGFX(gfxLoader) {
    return gfxLoader.loadRaw(`specs/${this.tileSpec}.png`);
  }
}

class EntityTextureCacheEntry extends TextureCacheEntry {
  constructor(key, defaultAsset, entityType) {
    super(key, defaultAsset);
    this.entityType = entityType;
  }

  createAsset(assetFactory, textureKey) {
    return assetFactory.createRaw(textureKey, this.key);
  }

  async loadGFX(gfxLoader) {
    return gfxLoader.loadRaw(`entities/${this.entityType}.png`);
  }
}

class CursorTextureCacheEntry extends TextureCacheEntry {
  createAsset(assetFactory, textureKey) {
    return assetFactory.createCursor(textureKey, this.key);
  }

  async loadGFX(gfxLoader) {
    return gfxLoader.loadRaw("cursor.png");
  }
}

class BlackTileTextureCacheEntry extends TextureCacheEntry {
  createAsset(assetFactory, textureKey) {
    return assetFactory.createRaw(textureKey, this.key);
  }

  async loadGFX(gfxLoader) {
    return gfxLoader.loadRaw("black.png");
  }
}

export const GridType = {
  Normal: "grid",
  Down: "grid-down",
  Right: "grid-right",
  All: "grid-all",
};

class GridTileTextureCacheEntry extends TextureCacheEntry {
  constructor(key, defaultAsset, gridType) {
    super(key, defaultAsset);
    this.gridType = gridType;
  }

  createAsset(assetFactory, textureKey) {
    return assetFactory.createRaw(textureKey, this.key);
  }

  async loadGFX(gfxLoader) {
    return gfxLoader.loadRaw(`${this.gridType}.png`);
  }
}

class JumboTextureCacheEntry {
  constructor(multiTexture, page, entry) {
    this.multiTexture = multiTexture;
    this.page = page;
    this.entry = entry;
  }

  get empty() {
    return this.page.empty;
  }

  destroy() {
    this.multiTexture.destroy();
    this.multiTexture = null;
    this.page = null;
    this.entry = null;
  }
}

class TextureCachePage {
  constructor(texturePage) {
    this.texturePage = texturePage;
    this.shelfPacker = new ShelfPack(texturePage.width, texturePage.height);
  }

  get empty() {
    return isEmpty(this.shelfPacker.bins);
  }
}

export class TextureCache {
  constructor(scene, gfxLoader, width, height) {
    this.scene = scene;
    this.gfxLoader = gfxLoader;
    this.identifier = Phaser.Utils.String.UUID();
    this.pages = [];
    this.jumboEntries = [];
    this.entries = new Map();
    this.pending = [];
    this.assetFactory = new AssetFactory(scene, this.identifier);

    this.multiTexture = new DrawableMultiTexture(
      this.scene.textures,
      this.identifier,
      width,
      height,
    );

    let firstPage = new TextureCachePage(this.multiTexture.pages[0]);
    this.pages.push(firstPage);
  }

  makeResourceKey(fileID, resourceID) {
    return fileID + "." + resourceID;
  }

  makeSpecKey(tileSpec) {
    return "spec." + tileSpec;
  }

  makeEntityKey(entityType) {
    return "entity." + entityType;
  }

  makeGridKey(gridType) {
    return "grid." + gridType;
  }

  getEntry(key, createEntry) {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = createEntry();
      this.entries.set(key, entry);
      this.pending.push(entry);
    }
    return entry;
  }

  getResource(fileID, resourceID) {
    let key = this.makeResourceKey(fileID, resourceID);
    return this.getEntry(key, () => {
      return new ResourceTextureCacheEntry(
        key,
        this.assetFactory.getDefault(),
        fileID,
        resourceID,
      );
    });
  }

  getSpec(tileSpec) {
    let key = this.makeSpecKey(tileSpec);
    return this.getEntry(key, () => {
      return new SpecTextureCacheEntry(
        key,
        this.assetFactory.getDefault(),
        tileSpec,
      );
    });
  }

  getEntity(entityType) {
    let key = this.makeEntityKey(entityType);
    return this.getEntry(key, () => {
      return new EntityTextureCacheEntry(
        key,
        this.assetFactory.getDefault(),
        entityType,
      );
    });
  }

  getBlackTile() {
    let key = "black";
    return this.getEntry(key, () => {
      return new BlackTileTextureCacheEntry(
        key,
        this.assetFactory.getDefault(),
      );
    });
  }

  getGridTile(gridType) {
    let key = this.makeGridKey(gridType);
    return this.getEntry(key, () => {
      return new GridTileTextureCacheEntry(
        key,
        this.assetFactory.getDefault(),
        gridType,
      );
    });
  }

  getCursor() {
    let key = "cursor";
    return this.getEntry(key, () => {
      return new CursorTextureCacheEntry(key, this.assetFactory.getDefault());
    });
  }

  findSpace(entry, width, height) {
    let bin = null;

    for (let i = 0; i < this.pages.length; ++i) {
      bin = this.findSpaceInPage(i, entry, width, height);

      if (bin) {
        break;
      }

      if (this.pages[i].empty) {
        console.error(
          `Failed to find space in the texture cache for "${entry.key}"`,
        );
        return false;
      }
    }

    if (!bin) {
      this.handleOutOfSpace();
      return this.findSpace(entry, width, height);
    }

    return true;
  }

  handleOutOfSpace() {
    this.addPage();
  }

  addPage() {
    let texturePage = this.multiTexture.addPage();
    let newPage = new TextureCachePage(texturePage);

    this.pages.push(newPage);
  }

  findSpaceInPage(pageIndex, entry, width, height) {
    let page = this.pages[pageIndex];
    let bin = page.shelfPacker.packOne(width, height);

    if (bin) {
      this.multiTexture.add(entry.key, pageIndex, bin.x, bin.y, width, height);
      entry.page = page;
      entry.bin = bin;
    }

    return !!bin;
  }

  async loadEntry(entry) {
    let pixels = await entry.loadGFX(this.gfxLoader);

    if (this.scene.textures.game === null) {
      // The texture manager was destroyed while the entry was loading.
      return;
    }

    if (
      !this.handleJumboEntry(entry, pixels) &&
      this.findSpace(entry, pixels.width, pixels.height)
    ) {
      let page = entry.page.texturePage;
      let x = entry.bin.x;
      let y = entry.bin.y;
      page.draw(pixels, x, y);
      entry.asset = entry.createAsset(this.assetFactory, this.multiTexture.key);
    }

    entry.loadingCompletePromise.resolve();
    entry.loadingCompletePromise = null;
  }

  handleJumboEntry(entry, pixels) {
    if (
      this.multiTexture.width >= pixels.width &&
      this.multiTexture.height >= pixels.height
    ) {
      return false;
    }

    const multiTexture = new DrawableMultiTexture(
      this.scene.textures,
      Phaser.Utils.String.UUID(),
      pixels.width,
      pixels.height,
    );

    const page = new TextureCachePage(multiTexture.pages[0]);
    const bin = page.shelfPacker.packOne(pixels.width, pixels.height);

    if (!bin) {
      multiTexture.destroy();
      throw new Error(
        `Failed to find space in the texture cache for jumbo entry "${entry.key}"`,
      );
    }

    multiTexture.add(entry.key, 0, bin.x, bin.y, pixels.width, pixels.height);
    page.texturePage.draw(pixels, bin.x, bin.y);

    entry.page = page;
    entry.bin = bin;
    entry.asset = entry.createAsset(this.assetFactory, multiTexture.key);

    this.jumboEntries.push(
      new JumboTextureCacheEntry(multiTexture, page, entry),
    );

    return true;
  }

  update() {
    let start = performance.now();
    let elapsed;
    let loaded = 0;
    let loadTime = Math.min(3, 1000 / this.scene.game.loop.actualFps / 2);

    this.pending.sort((a, b) => b.refCount - a.refCount);

    for (let entry of this.pending) {
      this.loadEntry(entry).catch((error) => {
        console.error(error);
      });
      ++loaded;
      elapsed = performance.now() - start;
      if (elapsed > loadTime) {
        break;
      }
    }

    this.pending.splice(0, loaded);
    if (loaded > 0) {
      console.debug(`Sent ${loaded} entries to the worker in ${elapsed}ms`);
    }
  }
}

export class EvictingTextureCache extends TextureCache {
  constructor(scene, gfxLoader, width, height) {
    super(scene, gfxLoader, width, height);
    this.canEvict = true;
  }

  getEntry(key, createEntry) {
    let entry = super.getEntry(key, createEntry);
    this.canEvict = true;
    return entry;
  }

  handleOutOfSpace() {
    if (this.canEvict) {
      this.evict();
    } else {
      this.addPage();
    }
  }

  evict() {
    for (let [key, value] of this.entries.entries()) {
      if (value.refCount === 0) {
        this.evictEntry(key);
      }
    }
    for (let jumboEntry of this.jumboEntries) {
      if (jumboEntry.empty) {
        this.evictJumboEntry(jumboEntry);
      }
    }
    this.canEvict = false;
  }

  evictEntry(key) {
    let entry = this.entries.get(key);
    let asset = entry.asset;
    let texture = this.scene.textures.get(asset.textureKey);

    let removeFromTexture = (frame) => {
      delete texture.frames[frame.name];
      texture.frameTotal--;
      frame.destroy();
    };

    removeFromTexture(asset.textureFrame);
    for (let animationFrame of asset.animationFrames) {
      removeFromTexture(animationFrame);
    }

    if (entry.bin) {
      let page = entry.page;
      page.shelfPacker.unref(entry.bin);
      if (page.empty) {
        page.shelfPacker = new ShelfPack(
          page.texturePage.width,
          page.texturePage.height,
        );
      }
    }

    this.entries.delete(key);
  }

  evictJumboEntry(jumboEntry) {
    jumboEntry.destroy();
    removeFirst(this.jumboEntries, jumboEntry);

    // Mitigate a bug in the Phaser WebGLRenderer, which will be fixed in version 3.60.
    // See: https://github.com/photonstorm/phaser/commit/4c2d3e3cff6b98ff05da99419a829203facf564f
    const renderer = this.scene.game.renderer;
    if (renderer.gl) {
      renderer.isTextureClean = false;
    }
  }
}
