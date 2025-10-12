import {
  blobToDataURL,
  dataURLToImageData,
} from "../../../util/data-url-utils";
import { LoadingStrategy } from "./loading-strategy";

export class LocalLoadingStrategy extends LoadingStrategy {
  constructor(egfDirectoryHandle, assetsDirectoryHandle) {
    super();
    this.egfDirectoryHandle = egfDirectoryHandle;
    this.assetsDirectoryHandle = assetsDirectoryHandle;
    this.bundledAssets = new Map();

    let context = require.context("../../../assets/bundled", true, /\.png$/);
    for (let item of context.keys()) {
      this.bundledAssets.set(item.replace("./", ""), context(item));
    }
  }

  async loadEGF(filename) {
    let fileHandle = await this.egfDirectoryHandle.getFileHandle(filename);
    let file = await fileHandle.getFile();
    return file.arrayBuffer();
  }

  async loadRaw(path) {
    return (await this.getOverrideAsset(path)) || this.getBundledAsset(path);
  }

  async getOverrideAsset(path) {
    if (!this.assetsDirectoryHandle) {
      return null;
    }

    try {
      let directoryHandle = this.assetsDirectoryHandle;
      let directoryNames = path.split("/");
      let fileName = directoryNames.pop();

      for (let directoryName of directoryNames) {
        directoryHandle =
          await directoryHandle.getDirectoryHandle(directoryName);
      }

      let fileHandle = await directoryHandle.getFileHandle(fileName);
      if (fileHandle) {
        let file = await fileHandle.getFile();
        let dataURL = await blobToDataURL(file);
        return dataURLToImageData(dataURL);
      }
    } catch (e) {
      return null;
    }
  }

  async getBundledAsset(path) {
    return dataURLToImageData(this.bundledAssets.get(path));
  }
}
