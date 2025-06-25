import Worker from "./gfx-loader.worker";
import { LoadType } from "./load-type";

import { PendingPromise } from "../../util/pending-promise";
import { dataURLToImage } from "../../util/data-url-utils";

import errorImage from "../../assets/error.png";

export class GFXLoader {
  constructor(loadingStrategy) {
    this.loadingStrategy = loadingStrategy;
    this.egfs = new Map();
    this.worker = this.setupWorker();
    this.pendingEGFs = new Map();
    this.pendingResources = new Map();
  }

  setupWorker() {
    let worker = new Worker();

    worker.onmessage = (event) => {
      let data = event.data;
      switch (data.loadType) {
        case LoadType.DIB:
          this.handleDIBMessage(data);
          break;
        case LoadType.EGF:
          this.handleEGFMessage(data);
          break;
        default:
          throw new Error(`Unhandled LoadType: ${data.loadType}`);
      }
    };

    worker.onerror = (error) => {
      console.error(error);
    };

    return worker;
  }

  handleDIBMessage(data) {
    let info = this.resourceInfo(data.fileID, data.resourceID);
    if (this.pendingResources.has(info)) {
      let pending = this.pendingResources.get(info);
      this.pendingResources.delete(info);

      if (data.error) {
        pending.reject(data.error);
      } else {
        let imageData = new ImageData(
          new Uint8ClampedArray(data.pixels),
          info.width,
          info.height,
        );
        pending.resolve(imageData);
      }
    }
  }

  handleEGFMessage(data) {
    let fileID = data.fileID;
    if (this.pendingEGFs.has(fileID)) {
      let pending = this.pendingEGFs.get(fileID);
      this.pendingEGFs.delete(fileID);

      if (data.error) {
        pending.reject(data.error);
      } else {
        pending.resolve(data.resourceInfo);
      }
    }
  }

  async loadEGF(fileID) {
    if (!this.egfs.has(fileID)) {
      if (this.pendingEGFs.has(fileID)) {
        return this.pendingEGFs.get(fileID).promise;
      }

      let pending = new PendingPromise();
      this.pendingEGFs.set(fileID, pending);

      let filename = "gfx" + fileID.toString().padStart(3, "0") + ".egf";
      let buffer = await this.loadingStrategy.loadEGF(filename);

      this.worker.postMessage(
        {
          loadType: LoadType.EGF,
          buffer: buffer,
          fileID: fileID,
        },
        [buffer],
      );

      let resourceInfo = await pending.promise;
      this.egfs.set(fileID, resourceInfo);
    }
  }

  resourceIDs(fileID) {
    let egf = this.egfs.get(fileID);
    if (egf) {
      return egf.keys();
    }
    return [];
  }

  resourceInfo(fileID, resourceID) {
    let result = null;

    let resourceInfo = this.egfs.get(fileID);
    if (resourceInfo) {
      let info = resourceInfo.get(resourceID);
      if (info) {
        result = info;
      }
    }
    return result;
  }

  async errorGfx(location, name) {
    let canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 32;

    let context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.font = "bolder 9px monospace";
    context.fillStyle = "white";
    context.textAlign = "center";

    context.drawImage(await dataURLToImage(errorImage), 0, 0);
    context.fillText(location, 32, 13);
    context.fillText(name, 32, 22);

    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  async loadResource(fileID, resourceID) {
    let info = this.resourceInfo(fileID, resourceID);
    if (info) {
      if (this.pendingResources.has(info)) {
        return this.pendingResources.get(info).promise;
      }

      let pending = new PendingPromise();
      this.pendingResources.set(info, pending);

      this.worker.postMessage({
        loadType: LoadType.DIB,
        fileID: fileID,
        resourceID: resourceID,
      });

      try {
        let imageData = await pending.promise;
        this.pendingResources.delete(info);
        return imageData;
      } catch (e) {
        console.error(
          "Failed to read resource %d from file %d: %s",
          resourceID,
          fileID,
          e,
        );
      }
    }

    return this.errorGfx(`egf ${fileID}`, resourceID.toString());
  }

  async loadRaw(path) {
    try {
      return await this.loadingStrategy.loadRaw(path);
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("Failed to load %s: %s", path, e);
      }
    }

    let lastSlash = path.lastIndexOf("/");
    let lastDot = path.lastIndexOf(".");
    if (lastDot === -1) {
      lastDot = undefined;
    }

    let location = path.substring(0, lastSlash) || "/";
    let name = path.substring(lastSlash + 1, lastDot);

    return this.errorGfx(location, name);
  }

  destroy() {
    this.loadingStrategy.abort();
    this.worker.terminate();

    this.loadingStrategy = null;
    this.egfs = null;
    this.worker = null;
    this.pendingEGFs = null;
    this.pendingResources = null;
  }
}
