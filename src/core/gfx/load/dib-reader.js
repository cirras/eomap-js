import { countOnes, trailingZeros } from "../../util/math-utils";
import { FaxCode } from "./fax-code";

const LOOKUP_TABLE_3_BIT_TO_8_BIT = [0, 36, 73, 109, 146, 182, 219, 255];

const LOOKUP_TABLE_4_BIT_TO_8_BIT = [
  0, 17, 34, 51, 68, 85, 102, 119, 136, 153, 170, 187, 204, 221, 238, 255,
];

const LOOKUP_TABLE_5_BIT_TO_8_BIT = [
  0, 8, 16, 25, 33, 41, 49, 58, 66, 74, 82, 90, 99, 107, 115, 123, 132, 140,
  148, 156, 165, 173, 181, 189, 197, 206, 214, 222, 230, 239, 247, 255,
];

const LOOKUP_TABLE_6_BIT_TO_8_BIT = [
  0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 45, 49, 53, 57, 61, 65, 69, 73, 77,
  81, 85, 89, 93, 97, 101, 105, 109, 113, 117, 121, 125, 130, 134, 138, 142,
  146, 150, 154, 158, 162, 166, 170, 174, 178, 182, 186, 190, 194, 198, 202,
  206, 210, 215, 219, 223, 227, 231, 235, 239, 243, 247, 251, 255,
];

const HeaderType = {
  Core: "BITMAPCOREHEADER",
  Core2: "BITMAPCOREHEADER2",
  Info: "BITMAPINFOHEADER",
  V2: "BITMAPV2INFOHEADER",
  V3: "BITMAPV3INFOHEADER",
  V4: "BITMAPV4HEADER",
  V5: "BITMAPV5HEADER",
};

const Compression = {
  RGB: "BI_RGB",
  RLE8: "BI_RLE8",
  RLE4: "BI_RLE4",
  Bitfields: "BI_BITFIELDS",
  Huffman1D: "BI_HUFFMAN1D",
  RLE24: "BI_RLE24",
  JPEG: "BI_JPEG",
  PNG: "BI_PNG",
  AlphaBitfields: "BI_ALPHABITFIELDS",
  CMYK: "BI_CMYK",
  CMYKRLE8: "BI_CMYKRLE8",
  CMYKRLE4: "BI_CMYKRLE4",
};

class PaletteColor {
  constructor(b, g, r) {
    this.b = b;
    this.g = g;
    this.r = r;
  }
}

// Bitfield(s) implementation is based directly on the image-rs BMPDecoder
// See: https://github.com/image-rs/image/blob/v0.24.4/src/codecs/bmp/decoder.rs#L479
class Bitfield {
  constructor(length, shift) {
    this.length = length;
    this.shift = shift;
  }

  static fromMask(mask, maxLength) {
    if (mask === 0) {
      return new Bitfield(0, 0);
    }

    let shift = trailingZeros(mask);
    let length = trailingZeros(~(mask >>> shift));

    if (length !== countOnes(mask)) {
      throw new Error("Non-contiguous bitfield mask");
    }

    if (length + shift > maxLength) {
      throw new Error("Bitfield mask too long");
    }

    if (length > 8) {
      shift += length - 8;
      length = 8;
    }

    return new Bitfield(length, shift);
  }

  read(data) {
    data = data >> this.shift;
    switch (this.length) {
      case 0:
        return 0;
      case 1:
        return (data & 0b1) * 0xff;
      case 2:
        return (data & 0b11) * 0x55;
      case 3:
        return LOOKUP_TABLE_3_BIT_TO_8_BIT[data & 0b00_0111];
      case 4:
        return LOOKUP_TABLE_4_BIT_TO_8_BIT[data & 0b00_1111];
      case 5:
        return LOOKUP_TABLE_5_BIT_TO_8_BIT[data & 0b01_1111];
      case 6:
        return LOOKUP_TABLE_6_BIT_TO_8_BIT[data & 0b11_1111];
      case 7:
        return ((data & 0x7f) << 1) | ((data & 0x7f) >> 6);
      case 8:
        return data & 0xff;
      default:
        throw new Error(`Unhandled bitfield mask length ${this.length}`);
    }
  }
}

class Bitfields {
  constructor(r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  static fromMask(redMask, greenMask, blueMask, alphaMask, maxLength) {
    return new Bitfields(
      Bitfield.fromMask(redMask, maxLength),
      Bitfield.fromMask(greenMask, maxLength),
      Bitfield.fromMask(blueMask, maxLength),
      Bitfield.fromMask(alphaMask, maxLength),
    );
  }
}

export class DIBReader {
  constructor(buffer) {
    this.data = buffer;
    this.dataView = new DataView(buffer);

    this.headerType = null;
    this.compression = null;
    this.readStrategy = null;
    this.bitFields = null;
    this.paletteColors = null;

    this.initialized = false;
  }

  readUint8(position) {
    return this.dataView.getUint8(position);
  }

  readUint16(position) {
    return this.dataView.getUint16(position, true);
  }

  readUint32(position) {
    return this.dataView.getUint32(position, true);
  }

  readInt32(position) {
    return this.dataView.getInt32(position, true);
  }

  get headerSize() {
    return this.readUint32(0);
  }

  get width() {
    if (this.headerType === HeaderType.Core) {
      return this.readUint16(4);
    } else {
      return this.readInt32(4);
    }
  }

  get height() {
    if (this.headerType === HeaderType.Core) {
      return this.readUint16(6);
    } else {
      return this.readInt32(8);
    }
  }

  get planes() {
    if (this.headerType === HeaderType.Core) {
      return this.readUint16(8);
    } else {
      return this.readUint16(12);
    }
  }

  get depth() {
    if (this.headerType === HeaderType.Core) {
      return this.readUint16(10);
    } else {
      return this.readUint16(14);
    }
  }

  get colorsUsed() {
    if (this.headerSize < 36) {
      return 0;
    } else {
      return this.readUint32(32);
    }
  }

  get optionalBitMasksSize() {
    // Present only in case the DIB header is the BITMAPINFOHEADER and the
    // Compression Method member is set to either BI_BITFIELDS or BI_ALPHABITFIELDS
    if (this.headerType === HeaderType.Info) {
      switch (this.compression) {
        case Compression.Bitfields:
          return 12;
        case Compression.AlphaBitfields:
          return 16;
        default:
        // do nothing
      }
    }

    return 0;
  }

  get paletteColorCount() {
    if (this.colorsUsed) {
      return this.colorsUsed;
    } else if (this.depth <= 8) {
      return 1 << this.depth;
    } else {
      return 0;
    }
  }

  get paletteSize() {
    const bytesPerColor = this.headerType === HeaderType.Core ? 3 : 4;
    return this.paletteColorCount * bytesPerColor;
  }

  get stride() {
    return ((this.width * this.depth + 31) & ~31) >> 3;
  }

  get hasRgbBitMasks() {
    switch (this.headerType) {
      case HeaderType.Core:
      case HeaderType.Core2:
        return false;
      case HeaderType.Info:
        return (
          this.compression === Compression.Bitfields ||
          this.compression === Compression.AlphaBitfields
        );
      default:
        return true;
    }
  }

  get hasAlphaBitMask() {
    switch (this.headerType) {
      case HeaderType.Core:
      case HeaderType.Core2:
      case HeaderType.V2:
        return false;
      case HeaderType.Info:
        return this.compression === Compression.AlphaBitfields;
      default:
        return true;
    }
  }

  get redMask() {
    if (!this.hasRgbBitMasks) {
      return 0;
    } else {
      return this.readUint32(40);
    }
  }

  get greenMask() {
    if (!this.hasRgbBitMasks) {
      return 0;
    } else {
      return this.readUint32(44);
    }
  }

  get blueMask() {
    if (!this.hasRgbBitMasks) {
      return 0;
    } else {
      return this.readUint32(48);
    }
  }

  get alphaMask() {
    if (!this.hasAlphaBitMask) {
      return 0;
    } else {
      return this.readUint32(52);
    }
  }

  colorFromPalette(index) {
    this.initialize();

    if (index >= this.paletteColors.length) {
      return new PaletteColor(0, 0, 0);
    }

    return this.paletteColors[index];
  }

  validateHeader() {
    if (
      this.dataView.byteLength < 4 ||
      this.dataView.byteLength < this.headerSize
    ) {
      throw new Error("Truncated header");
    }

    if (!Object.values(HeaderType).includes(this.headerType)) {
      throw new Error(`Unknown header type with size ${this.headerSize}`);
    }

    if (!Object.values(Compression).includes(this.compression)) {
      throw new Error("Unknown compression type");
    }

    if (this.width <= 0) {
      throw new Error("Image width must be positive");
    }

    if (this.height === 0) {
      throw new Error("Image height cannot be zero");
    }

    if (
      this.height < 0 &&
      [HeaderType.Core, HeaderType.Core2].includes(this.headerType)
    ) {
      throw new Error(`Top-down bitmaps not supported for ${this.headerType}`);
    }

    if (
      this.width > 0x40000000 ||
      this.height < -0x40000000 ||
      this.height > 0x40000000
    ) {
      throw new Error("Image dimensions out of bounds");
    }

    if (this.planes !== 1) {
      throw new Error(`Invalid number of color planes (${this.planes})`);
    }

    switch (this.headerType) {
      case HeaderType.Core:
        this.validateHeaderTypeDepth(1, 2, 4, 8, 24);
        break;
      case HeaderType.Core2:
        this.validateHeaderTypeDepth(1, 2, 4, 8, 24);
        this.validateHeaderTypeCompression(
          Compression.RGB,
          Compression.RLE8,
          Compression.RLE4,
          Compression.Huffman1D,
          Compression.RLE24,
        );
        break;
      default:
        this.validateHeaderTypeDepth(1, 2, 4, 8, 16, 24, 32);
        this.validateHeaderTypeCompression(
          Compression.RGB,
          Compression.RLE8,
          Compression.RLE4,
          Compression.Bitfields,
          Compression.JPEG,
          Compression.PNG,
          Compression.AlphaBitfields,
        );
    }

    switch (this.compression) {
      case Compression.RGB:
        this.validateCompressionDepth(1, 2, 4, 8, 16, 24, 32);
        break;

      case Compression.RLE8:
        this.validateCompressionDepth(8);
        break;

      case Compression.RLE4:
        this.validateCompressionDepth(4);
        break;

      case Compression.Bitfields:
      case Compression.AlphaBitfields:
        this.validateCompressionDepth(16, 32);
        break;

      case Compression.Huffman1D:
        this.validateCompressionDepth(1);
        break;

      case Compression.RLE24:
        this.validateCompressionDepth(24);
        break;

      default:
        throw new Error(`Unsupported compression (${this.compression})`);
    }

    if (this.colorsUsed > 1 << this.depth) {
      throw new Error(
        `Palette size ${this.paletteColorCount} exceeds maximum value for ${this.depth}-bit image`,
      );
    }
  }

  validateHeaderTypeDepth(...allowedDepths) {
    if (!allowedDepths.includes(this.depth)) {
      throw new Error(
        `Invalid bit depth for ${this.headerType} (${this.depth})`,
      );
    }
  }

  validateHeaderTypeCompression(...allowedCompressions) {
    if (!allowedCompressions.includes(this.compression)) {
      throw new Error(
        `Invalid compression for ${this.headerType} (${this.compression})`,
      );
    }
  }

  validateCompressionDepth(...allowedDepths) {
    if (!allowedDepths.includes(this.depth)) {
      throw new Error(
        `Invalid bit depth for ${this.compression} (${this.depth})`,
      );
    }
  }

  determineHeaderType() {
    if (this.dataView.byteLength < 4) {
      return;
    }

    const size = this.headerSize;

    switch (size) {
      case 12:
        this.headerType = HeaderType.Core;
        break;
      case 40:
        this.headerType = HeaderType.Info;
        break;
      case 52:
        this.headerType = HeaderType.V2;
        break;
      case 56:
        this.headerType = HeaderType.V3;
        break;
      case 108:
        this.headerType = HeaderType.V4;
        break;
      case 124:
        this.headerType = HeaderType.V5;
        break;
      default:
        if (this.detectCoreHeader2WithSizeHeuristic()) {
          this.headerType = HeaderType.Core2;
        }
    }

    if (this.detectCoreHeader2WithCompressionTypeHeuristic()) {
      this.headerType = HeaderType.Core2;
    }
  }

  detectCoreHeader2WithSizeHeuristic() {
    const size = this.headerSize;
    // BITMAPCOREHEADER2 headers are variable-sized.
    // Any multiple of 4 between 16 and 64, or 42, or 46.
    return (
      size >= 16 && size <= 64 && (size % 4 === 0 || size === 42 || size === 46)
    );
  }

  detectCoreHeader2WithCompressionTypeHeuristic() {
    if (this.headerSize >= 20 && this.dataView.byteLength >= 20) {
      const compression = this.readUint32(16);
      if (compression === 3 && this.depth === 1) {
        // HUFFMAN1D
        return true;
      }
      if (compression === 4 && this.depth === 24) {
        // RLE24
        return true;
      }
    }
    return false;
  }

  determineCompression() {
    if (this.headerSize < 20) {
      this.compression = Compression.RGB;
      return;
    }

    if (this.dataView.byteLength < 20) {
      this.compression = null;
      return;
    }

    switch (this.readUint32(16)) {
      case 0:
        this.compression = Compression.RGB;
        break;
      case 1:
        this.compression = Compression.RLE8;
        break;
      case 2:
        this.compression = Compression.RLE4;
        break;
      case 3:
        this.compression =
          this.headerType === HeaderType.Core2
            ? Compression.Huffman1D
            : Compression.Bitfields;
        break;
      case 4:
        this.compression =
          this.headerType === HeaderType.Core2
            ? Compression.RLE24
            : Compression.JPEG;
        break;
      case 5:
        this.compression = Compression.PNG;
        break;
      case 6:
        this.compression = Compression.AlphaBitfields;
        break;
      case 11:
        this.compression = Compression.CMYK;
        break;
      case 12:
        this.compression = Compression.CMYKRLE8;
        break;
      case 13:
        this.compression = Compression.CMYKRLE4;
        break;
      default:
        this.compression = null;
        break;
    }
  }

  determineReadStrategy() {
    switch (this.compression) {
      case Compression.RLE4:
      case Compression.RLE8:
      case Compression.RLE24:
        this.readStrategy = new RLEReadStrategy(this);
        return;
      case Compression.Huffman1D:
        this.readStrategy = new HuffmanReadStrategy(this);
        return;
      default:
      // do nothing
    }

    switch (this.depth) {
      case 1:
      case 2:
      case 4:
      case 8:
        this.readStrategy = new PalettedReadStrategy(this);
        break;
      case 16:
      case 24:
      case 32:
        this.readStrategy = new RGBReadStrategy(this);
        break;
      default:
        throw new Error(`Unhandled bit depth: ${this.depth}`);
    }
  }

  decodeBitfields() {
    if (
      [Compression.Bitfields, Compression.AlphaBitfields].includes(
        this.compression,
      )
    ) {
      this.bitFields = Bitfields.fromMask(
        this.redMask,
        this.greenMask,
        this.blueMask,
        this.alphaMask,
        this.depth,
      );
    } else {
      switch (this.depth) {
        case 16:
          this.bitFields = Bitfields.fromMask(
            0x00007c00,
            0x000003e0,
            0x0000001f,
            0x00000000,
            this.depth,
          );
          break;

        case 24:
        case 32:
          this.bitFields = Bitfields.fromMask(
            0x00ff0000,
            0x0000ff00,
            0x000000ff,
            0x00000000,
            this.depth,
          );
          break;
      }
    }
  }

  indexPalette() {
    if (this.depth > 8) {
      return;
    }

    this.paletteColors = new Array(this.paletteColorCount);
    let pos = this.headerSize + this.optionalBitMasksSize;

    for (let i = 0; i < this.paletteColors.length; ++i) {
      this.paletteColors[i] = new PaletteColor(
        this.readUint8(pos++),
        this.readUint8(pos++),
        this.readUint8(pos++),
      );

      if (this.headerType !== HeaderType.Core) {
        // rgbReserved is reserved and must be zero
        // See: https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-rgbquad
        pos++;
      }
    }
  }

  initialize() {
    if (this.initialized) {
      return;
    }

    this.determineHeaderType();
    this.determineCompression();
    this.validateHeader();
    this.determineReadStrategy();
    this.decodeBitfields();
    this.indexPalette();

    this.initialized = true;
  }

  read() {
    this.initialize();

    const outputSize = this.width * Math.abs(this.height) * 4;
    const imageData = new Uint8ClampedArray(outputSize);
    this.readStrategy.read(imageData);

    return imageData;
  }
}

class ReadStrategy {
  constructor(reader) {
    this.reader = reader;
    this.width = this.reader.width;
    this.height = this.reader.height;
  }

  read(_outBuffer) {
    throw new Error("ReadStrategy.read() must be implemented");
  }

  getAlpha(r, g, b) {
    if (r !== 0 || g !== 0 || b !== 0) {
      return 0xff;
    } else {
      return 0x00;
    }
  }
}

class LineByLineReadStrategy extends ReadStrategy {
  read(outBuffer) {
    const rowCount = Math.abs(this.height);
    const isTopDown = this.height < 0;

    for (let row = 0; row < rowCount; ++row) {
      const line = isTopDown ? row : this.height - 1 - row;

      const outPos = this.width * row * 4;
      const linePos =
        this.reader.headerSize +
        this.reader.optionalBitMasksSize +
        this.reader.paletteSize +
        this.reader.stride * line;

      this.readLine(outBuffer, outPos, linePos);
    }
  }

  readLine(_outBuffer, _outPos, _linePos) {
    throw new Error("LineByLineReadStrategy.readLine() must be implemented");
  }
}

class RGBReadStrategy extends LineByLineReadStrategy {
  constructor(reader) {
    super(reader);
    this.bytesPerPixel = this.reader.depth >> 3;
  }

  readLine(outBuffer, outPos, linePos) {
    for (let i = 0; i < this.width; ++i) {
      let r = 0;
      let g = 0;
      let b = 0;

      let p = this.readUint32WithZeroPadding(linePos);
      r = this.bitFields.r.read(p);
      g = this.bitFields.g.read(p);
      b = this.bitFields.b.read(p);

      outBuffer[outPos++] = r;
      outBuffer[outPos++] = g;
      outBuffer[outPos++] = b;
      outBuffer[outPos++] = this.getAlpha(r, g, b);

      linePos += this.bytesPerPixel;
    }
  }

  readUint32WithZeroPadding(position) {
    if (position + 4 <= this.reader.dataView.byteLength) {
      return this.reader.readUint32(position);
    }

    let bytes = new Uint8Array([0, 0, 0, 0]);

    for (let i = 0; i < bytes.length; ++i) {
      if (position >= this.reader.dataView.byteLength) {
        break;
      }
      bytes[i] = this.reader.readUint8(position++);
    }

    return new DataView(bytes.buffer).getUint32(0, true);
  }

  get bitFields() {
    return this.reader.bitFields;
  }
}

class PalettedReadStrategy extends LineByLineReadStrategy {
  constructor(reader) {
    super(reader);
    this.pixelsPerByte = 8 / this.reader.depth;
    this.bytesPerLine = Math.ceil(this.width / this.pixelsPerByte);
    this.getPaletteIndices =
      PalettedReadStrategy.createGetPaletteIndicesFunction(this.reader.depth);
  }

  static createGetPaletteIndicesFunction(depth) {
    switch (depth) {
      case 1:
        return (byte) => {
          let indices = new Array(8);
          for (let i = 0; i < 8; ++i) {
            indices[7 - i] = (byte & (1 << i)) >> i;
          }
          return indices;
        };
      case 2:
        return (byte) => {
          return [
            (byte & 0xc0) >> 6,
            (byte & 0x30) >> 4,
            (byte & 0x0c) >> 2,
            byte & 0x03,
          ];
        };
      case 4:
        return (byte) => {
          return [(byte & 0xf0) >> 4, byte & 0x0f];
        };
      case 8:
        return (byte) => {
          return [byte];
        };
      default:
        throw new Error(`Unhandled bit depth: ${depth}`);
    }
  }

  readLine(outBuffer, outPos, linePos) {
    let written = 0;

    for (let i = 0; i < this.bytesPerLine; ++i) {
      const byte = this.readUint8WithZeroPadding(linePos);
      const paletteIndices = this.getPaletteIndices(byte);

      for (let paletteIndex of paletteIndices) {
        const color = this.reader.colorFromPalette(paletteIndex);
        const { b, g, r } = color;

        outBuffer[outPos++] = r;
        outBuffer[outPos++] = g;
        outBuffer[outPos++] = b;
        outBuffer[outPos++] = this.getAlpha(r, g, b);

        if (++written === this.width) {
          return;
        }
      }

      ++linePos;
    }
  }

  readUint8WithZeroPadding(position) {
    if (position < this.reader.dataView.byteLength) {
      return this.reader.readUint8(position);
    }
    return 0;
  }
}

// See: https://learn.microsoft.com/en-us/windows/win32/gdi/bitmap-compression
class RLEReadStrategy extends ReadStrategy {
  constructor(reader) {
    super(reader);
    this.compression = reader.compression;
    this.setPixelGenerator = RLEReadStrategy.createSetPixelGeneratorFunction(
      this.compression,
    );
    this.dataPos = null;
    this.x = null;
    this.y = null;
  }

  static createSetPixelGeneratorFunction(compression) {
    switch (compression) {
      case Compression.RLE8:
        return function* (outBuffer) {
          let color = this.reader.colorFromPalette(this.readUint8());
          while (true) {
            this.setPixel(color.r, color.g, color.b, outBuffer);
            yield;
          }
        };

      case Compression.RLE4:
        return function* (outBuffer) {
          const indices = this.readUint8();
          let color = null;
          let i = 0;
          while (true) {
            switch (i++ % 2) {
              case 0:
                color = this.reader.colorFromPalette((indices & 0xf0) >> 4);
                break;
              case 1:
                color = this.reader.colorFromPalette(indices & 0x0f);
                break;
            }
            this.setPixel(color.r, color.g, color.b, outBuffer);
            yield;
          }
        };

      case Compression.RLE24:
        return function* (outBuffer) {
          const b = this.readUint8();
          const g = this.readUint8();
          const r = this.readUint8();
          while (true) {
            this.setPixel(r, g, b, outBuffer);
            yield;
          }
        };
    }
  }

  init() {
    this.dataPos =
      this.reader.headerSize +
      this.reader.optionalBitMasksSize +
      this.reader.paletteSize;
    this.x = 0;
    this.y = 0;
  }

  peekInstruction() {
    if (this.reader.readUint8(this.dataPos) === 0) {
      return this.reader.readUint8(this.dataPos + 1);
    }
    return null;
  }

  validatePosition() {
    if (this.x >= this.width || this.y >= Math.abs(this.height)) {
      throw new Error("Image output position out of bounds");
    }
  }

  offsetCursor(x, y) {
    this.x += x;
    this.y += y;
    if (this.peekInstruction() === 1) {
      // End of bitmap
      return;
    }
    this.validatePosition();
  }

  nextLine() {
    this.x = 0;
    this.y++;
    if (this.peekInstruction() === 1) {
      // End of bitmap
      return;
    }
    this.validatePosition();
  }

  setPixel(r, g, b, outBuffer) {
    const isTopDown = this.height < 0;
    const line = isTopDown ? this.y : this.height - 1 - this.y;
    const pos = (this.width * line + this.x) * 4;

    outBuffer[pos + 0] = r;
    outBuffer[pos + 1] = g;
    outBuffer[pos + 2] = b;
    outBuffer[pos + 3] = this.getAlpha(r, g, b);

    this.x++;
  }

  executeInstruction(instruction, outBuffer) {
    switch (instruction) {
      // End of line
      case 0:
        this.nextLine();
        break;

      // End of bitmap
      case 1:
        return false;

      // Delta
      case 2:
        this.offsetCursor(this.readUint8(), this.readUint8());
        break;

      // Absolute
      default: {
        const length = instruction;
        this.readAbsoluteMode(length, outBuffer);
        break;
      }
    }

    return true;
  }

  readAbsoluteMode(length, outBuffer) {
    let i = 0;
    let generator = null;

    while (i < length) {
      if (this.x === this.width) {
        // Absolute mode cannot span multiple rows
        return false;
      }
      if (this.compression !== Compression.RLE4 || i % 2 === 0) {
        generator = this.setPixelGenerator(outBuffer);
      }
      generator.next();
      ++i;
    }

    // In absolute mode, each run must be aligned on a word boundary.
    this.dataPos += this.dataPos & 1;
  }

  readEncodedMode(length, outBuffer) {
    const generator = this.setPixelGenerator(outBuffer);
    for (let i = 0; i < length; ++i) {
      if (this.x === this.width) {
        this.nextLine();
        break;
      }
      generator.next();
    }
  }

  read(outBuffer) {
    this.init();

    while (this.dataPos < this.dataLength) {
      const controlByte = this.readUint8();
      if (controlByte === 0) {
        const instruction = this.readUint8();
        if (!this.executeInstruction(instruction, outBuffer)) {
          break;
        }
      } else {
        // Encoded mode
        const length = controlByte;
        this.readEncodedMode(length, outBuffer);
      }
    }

    return this.imageData;
  }

  readUint8() {
    try {
      return this.reader.readUint8(this.dataPos++);
    } catch (e) {
      throw new Error("Ran out of RLE data");
    }
  }

  get dataLength() {
    return this.reader.dataView.byteLength;
  }
}

const RunType = {
  White: 0,
  Black: 1,
};

const RunResult = {
  Continue: 0,
  EOL: 1,
  EOF: 2,
};

// Based on ReadHuffmanG31D from Clowd.Clipboard
//
// See:
// https://github.com/clowd/Clowd.Clipboard/blob/c46ff3b83a22ac05822be67266e314207e48978f/src/Clowd.Clipboard/Bitmaps/BitmapCorePixelReader.cs#L455
class HuffmanReadStrategy extends ReadStrategy {
  constructor(reader) {
    super(reader);
    this.dataPos = null;
    this.firstCode = null;
    this.currentCode = null;
    this.bitsRemaining = null;
    this.x = null;
  }

  init() {
    this.dataPos = this.reader.headerSize + this.reader.paletteSize;
    this.firstCode = true;
    this.currentCode = 0;
    this.bitsRemaining = 0;
  }

  readCode(faxCodes) {
    for (const faxCode of faxCodes) {
      while (this.bitsRemaining < faxCode.bitLength) {
        if (this.dataPos >= this.reader.dataView.byteLength) {
          return null;
        }

        this.currentCode <<= 8;
        this.currentCode |= this.readUint8();
        this.bitsRemaining += 8;
      }

      if (
        faxCode.code ===
        this.currentCode >>> (this.bitsRemaining - faxCode.bitLength)
      ) {
        this.bitsRemaining -= faxCode.bitLength;

        const mask = (1 << this.bitsRemaining) - 1;
        this.currentCode &= mask;

        if (this.firstCode && faxCode.runLength < 0) {
          // Sometimes the data stream starts with an EOL code, let's skip it.
          this.firstCode = false;
          return this.readCode(faxCodes);
        }

        this.firstCode = false;
        return faxCode;
      }
    }
    return null;
  }

  readRun(runType, outBuffer) {
    let color;
    let faxCodes;

    switch (runType) {
      case RunType.White:
        color = 0xff;
        faxCodes = FaxCode.WHITE_CODES;
        break;
      case RunType.Black:
        color = 0x00;
        faxCodes = FaxCode.BLACK_CODES;
        break;
      default:
        throw new Error(`Unhandled RunType: ${runType}`);
    }

    let code;

    while (true) {
      code = this.readCode(faxCodes);
      if (!code) {
        return RunResult.EOF;
      }

      if (code.runLength > 0) {
        let pos = (this.y * this.width + this.x) * 4;
        for (let i = 0; i < code.runLength; ++i) {
          outBuffer[pos++] = color;
          outBuffer[pos++] = color;
          outBuffer[pos++] = color;
          outBuffer[pos++] = this.getAlpha(color, color, color);
          this.x++;
        }
      }

      if (code.runLength < 64) {
        // EOL or terminating code
        break;
      }
    }

    if (code.runLength < 0) {
      return RunResult.EOL;
    }

    return RunResult.Continue;
  }

  read(outBuffer) {
    this.init();

    for (this.y = this.height - 1; this.y >= 0; --this.y) {
      this.x = 0;

      while (true) {
        {
          const result = this.readRun(RunType.White, outBuffer);

          if (result === RunResult.EOL) {
            break;
          }

          if (result === RunResult.EOF) {
            return;
          }
        }

        {
          const result = this.readRun(RunType.Black, outBuffer);

          if (result === RunResult.EOL) {
            break;
          }

          if (result === RunResult.EOF) {
            return;
          }
        }
      }
    }
  }

  readUint8() {
    return this.reader.readUint8(this.dataPos++);
  }
}
