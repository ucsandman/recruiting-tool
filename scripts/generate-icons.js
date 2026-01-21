/**
 * Icon Generator Script
 * Creates simple PNG icons for the extension
 * Run with: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Simple PNG generator for solid color squares
// This creates minimal valid PNG files

function createPNG(size, color) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = createIHDR(size, size);

  // IDAT chunk (image data)
  const idat = createIDAT(size, size, color);

  // IEND chunk
  const iend = createIEND();

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createIHDR(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.writeUInt8(8, 8);  // bit depth
  data.writeUInt8(2, 9);  // color type (RGB)
  data.writeUInt8(0, 10); // compression
  data.writeUInt8(0, 11); // filter
  data.writeUInt8(0, 12); // interlace

  return createChunk('IHDR', data);
}

function createIDAT(width, height, color) {
  const zlib = require('zlib');

  // Create raw image data (RGB)
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // Filter byte
    for (let x = 0; x < width; x++) {
      // Create a simple icon with the letter "R" shape or just solid
      const isR = isPartOfR(x, y, width, height);
      if (isR) {
        rawData.push(255, 255, 255); // White for "R"
      } else {
        rawData.push(color.r, color.g, color.b); // Background color
      }
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(rawData));
  return createChunk('IDAT', compressed);
}

function isPartOfR(x, y, width, height) {
  // Create a simple "R" letter pattern
  const margin = Math.floor(width * 0.25);
  const thickness = Math.max(2, Math.floor(width * 0.15));

  const left = margin;
  const right = width - margin;
  const top = margin;
  const bottom = height - margin;
  const midY = Math.floor((top + bottom) / 2);
  const midX = Math.floor((left + right) / 2);

  // Vertical bar of R
  if (x >= left && x < left + thickness && y >= top && y <= bottom) {
    return true;
  }

  // Top horizontal bar
  if (y >= top && y < top + thickness && x >= left && x <= right - thickness) {
    return true;
  }

  // Middle horizontal bar
  if (y >= midY - thickness/2 && y < midY + thickness/2 && x >= left && x <= midX) {
    return true;
  }

  // Right vertical (top half)
  if (x >= right - thickness && x <= right && y >= top && y <= midY) {
    return true;
  }

  // Diagonal leg
  const diagStart = midY;
  const diagEnd = bottom;
  if (y >= diagStart && y <= diagEnd) {
    const progress = (y - diagStart) / (diagEnd - diagStart);
    const diagX = midX + (right - midX) * progress;
    if (x >= diagX - thickness/2 && x <= diagX + thickness/2) {
      return true;
    }
  }

  return false;
}

function createIEND() {
  return createChunk('IEND', Buffer.alloc(0));
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation for PNG
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = getCRC32Table();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let crcTable = null;
function getCRC32Table() {
  if (crcTable) return crcTable;

  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }
  return crcTable;
}

// Main execution
const sizes = [16, 32, 48, 128];
const color = { r: 30, g: 64, b: 175 }; // #1E40AF (primary blue)

const iconsDir = path.join(__dirname, '..', 'icons');

sizes.forEach(size => {
  const png = createPNG(size, color);
  const filename = `icon-${size}.png`;
  const filepath = path.join(iconsDir, filename);
  fs.writeFileSync(filepath, png);
  console.log(`Created ${filename}`);
});

console.log('All icons generated successfully!');
