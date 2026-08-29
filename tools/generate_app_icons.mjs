import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const root = dirname(toolsDir);
const sourcePath = join(toolsDir, "assets", "aiasap-app-icon.svg");
const source = await readFile(sourcePath);

async function png(size) {
  return sharp(source, { density: 384 })
    .resize(size, size, { fit: "fill" })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

const icon512 = await png(512);
await writeFile(join(root, "app", "icon.png"), icon512);
await writeFile(join(root, "app", "apple-icon.png"), await png(180));
// Retire the historical public aiA/social icon without breaking old cached URLs.
// Every legacy and current browser identity URL now serves the canonical brown 6.
await writeFile(join(root, "public", "aiasap-app-icon.png"), icon512);
await writeFile(join(root, "public", "aiasap-app-icon.svg"), source);

// ICO supports PNG-compressed entries. Keep the standard browser sizes in one
// deterministic file so Windows bookmarks and tiny tabs use the same single 6.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
const directory = Buffer.alloc(images.length * 16);
let offset = header.length + directory.length;
images.forEach((image, index) => {
  const entry = index * 16;
  directory.writeUInt8(sizes[index], entry);
  directory.writeUInt8(sizes[index], entry + 1);
  directory.writeUInt8(0, entry + 2);
  directory.writeUInt8(0, entry + 3);
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(image.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(join(root, "app", "favicon.ico"), Buffer.concat([header, directory, ...images]));

console.log("Generated current and legacy browser identity assets from the single-6 SVG.");
