// grid.ts

// Grid constants.
export const GRID_WIDTH = 50;
export const GRID_HEIGHT = 50;
export const NUM_CELLS = GRID_WIDTH * GRID_HEIGHT;

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Encodes a Uint8Array to a base64 string.
 * This implementation does not rely on Buffer, btoa, or atob.
 * @param bytes The Uint8Array to encode.
 * @returns A base64 encoded string.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    // Get three bytes (or however many remain)
    const byte1 = bytes[i++];
    const byte2 = i < bytes.length ? bytes[i++] : NaN;
    const byte3 = i < bytes.length ? bytes[i++] : NaN;

    // Convert to four 6-bit numbers.
    const enc1 = byte1 >> 2;
    const enc2 = ((byte1 & 0x03) << 4) | (isNaN(byte2) ? 0 : byte2 >> 4);
    const enc3 = isNaN(byte2) ? 64 : ((byte2 & 0x0f) << 2) | (isNaN(byte3) ? 0 : byte3 >> 6);
    const enc4 = isNaN(byte3) ? 64 : byte3 & 0x3f;

    result +=
      BASE64_CHARS.charAt(enc1) +
      BASE64_CHARS.charAt(enc2) +
      (enc3 === 64 ? "=" : BASE64_CHARS.charAt(enc3)) +
      (enc4 === 64 ? "=" : BASE64_CHARS.charAt(enc4));
  }
  return result;
}

/**
 * Decodes a base64 string into a Uint8Array.
 * This implementation does not rely on Buffer, btoa, or atob.
 * @param base64 The base64 string to decode.
 * @returns The resulting Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  // Remove any padding characters.
  const cleanBase64 = base64.replace(/=+$/, "");
  const byteArray: number[] = [];
  let i = 0;

  while (i < cleanBase64.length) {
    const enc1 = BASE64_CHARS.indexOf(cleanBase64.charAt(i++));
    const enc2 = BASE64_CHARS.indexOf(cleanBase64.charAt(i++));
    const enc3 = i < cleanBase64.length ? BASE64_CHARS.indexOf(cleanBase64.charAt(i++)) : 64;
    const enc4 = i < cleanBase64.length ? BASE64_CHARS.indexOf(cleanBase64.charAt(i++)) : 64;

    const byte1 = (enc1 << 2) | (enc2 >> 4);
    const byte2 = ((enc2 & 0x0f) << 4) | (enc3 >> 2);
    const byte3 = ((enc3 & 0x03) << 6) | enc4;

    byteArray.push(byte1);
    if (enc3 !== 64 && cleanBase64.charAt(i - 2) !== "=") {
      byteArray.push(byte2);
    }
    if (enc4 !== 64 && cleanBase64.charAt(i - 1) !== "=") {
      byteArray.push(byte3);
    }
  }

  return new Uint8Array(byteArray);
}

/**
 * 4-bit grid: each cell holds a value 0-15.
 * Two cells are packed per byte.
 */
export class Grid4Bit {
  private data: Uint8Array;

  constructor() {
    // Allocate enough bytes to store NUM_CELLS 4-bit values (2 per byte)
    this.data = new Uint8Array(Math.ceil(NUM_CELLS / 2));
  }

  // Returns the 4-bit value at (x, y)
  public get(x: number, y: number): number {
    this.validateCoordinates(x, y);
    const index = y * GRID_WIDTH + x;
    const byteIndex = Math.floor(index / 2);
    const isLower = index % 2 === 0;
    const byte = this.data[byteIndex];
    return isLower ? byte & 0x0f : (byte >> 4) & 0x0f;
  }

  // Sets the 4-bit value at (x, y). Value must be in [0,15].
  public set(x: number, y: number, value: number): void {
    this.validateCoordinates(x, y);
    if (value < 0 || value > 15) {
      throw new RangeError("Value must be between 0 and 15 for a 4-bit cell");
    }
    const index = y * GRID_WIDTH + x;
    const byteIndex = Math.floor(index / 2);
    const isLower = index % 2 === 0;
    if (isLower) {
      // Preserve upper 4 bits, update lower.
      this.data[byteIndex] = (this.data[byteIndex] & 0xf0) | (value & 0x0f);
    } else {
      // Preserve lower 4 bits, update upper.
      this.data[byteIndex] = (this.data[byteIndex] & 0x0f) | ((value & 0x0f) << 4);
    }
  }

  // Validates cell coordinates.
  private validateCoordinates(x: number, y: number): void {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
      throw new RangeError(`Coordinates out of bounds: (${x}, ${y})`);
    }
  }

  // Returns the grid as a serialized JSON string.
  public serialize(): string {
    return uint8ArrayToBase64(this.data);
  }

  // Reconstruct a Grid4Bit instance from a serialized JSON string.
  public static fromSerialized(serialized: string): Grid4Bit {
    const grid = new Grid4Bit();
    grid.data = base64ToUint8Array(serialized);
    return grid;
  }

  public print(): void {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      let line = "";
      for (let x = 0; x < GRID_WIDTH; x++) {
        line += this.get(x, y).toString(16);
      }
      console.log(line);
    }
  }
}

/**
 * 8-bit grid: each cell holds a value 0-255.
 */
export class Grid8Bit {
  private data: Uint8Array;

  constructor() {
    // One byte per cell.
    this.data = new Uint8Array(NUM_CELLS);
  }

  // Returns the 8-bit value at (x, y)
  public get(x: number, y: number): number {
    this.validateCoordinates(x, y);
    return this.data[y * GRID_WIDTH + x];
  }

  // Sets the 8-bit value at (x, y). Value must be in [0,255].
  public set(x: number, y: number, value: number): void {
    this.validateCoordinates(x, y);
    if (value < 0 || value > 255) {
      throw new RangeError("Value must be between 0 and 255 for an 8-bit cell");
    }
    this.data[y * GRID_WIDTH + x] = value;
  }

  // Validates cell coordinates.
  private validateCoordinates(x: number, y: number): void {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
      throw new RangeError(`Coordinates out of bounds: (${x}, ${y})`);
    }
  }

  // Returns the grid as a serialized JSON string.
  public serialize(): string {
    return uint8ArrayToBase64(this.data);
  }

  // Reconstruct a Grid8Bit instance from a serialized JSON string.
  public static fromSerialized(serialized: string): Grid8Bit {
    const grid = new Grid8Bit();
    grid.data = base64ToUint8Array(serialized);
    return grid;
  }
  public print(): void {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      let line = "";
      for (let x = 0; x < GRID_WIDTH; x++) {
        line += this.get(x, y).toString(16);
      }
      console.log(line);
    }
  }
  public static fromCostMatrix(costMatrix: CostMatrix): Grid8Bit {
    const grid = new Grid8Bit();
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        grid.set(x, y, costMatrix.get(x, y));
      }
    }
    return grid;
  }
  public toCostMatrix(): CostMatrix {
    const costMatrix = new PathFinder.CostMatrix();
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        costMatrix.set(x, y, this.get(x, y));
      }
    }
    return costMatrix;
  }
}

export function readCellFromSerializedGrid4(serializedGrid: string, x: number, y: number): number {
  const data = base64ToUint8Array(serializedGrid);
  const index = y * GRID_WIDTH + x;

  const byteIndex = Math.floor(index / 2);
  const isLowerNibble = index % 2 === 0;
  const byte = data[byteIndex];
  return isLowerNibble ? byte & 0x0f : (byte >> 4) & 0x0f;
}
export function readCellFromSerializedGrid8(serializedGrid: string, x: number, y: number): number {
  const data = base64ToUint8Array(serializedGrid);
  const index = y * GRID_WIDTH + x;
  return data[index];
}
