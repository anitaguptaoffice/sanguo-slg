/**
 * CLIENT-040: lossless-pixel WebP/JPEG from CLIENT-039 full PNG (<1MB for art connector).
 * Source PNG stays in docs/art/samples/client-039/.
 * Usage: node scripts/compress-client-040-evidence.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const srcPng = path.resolve(clientRoot, "../docs/art/samples/client-039/military-1280x720-dpr1-full.png");
const outDir = path.resolve(clientRoot, "../docs/art/samples/client-040");

const outputs = [
  {
    file: "military-1280x720-dpr1-full.webp",
    args: ["-c:v", "libwebp", "-quality", "85", "-update", "1"],
  },
  {
    file: "military-1280x720-dpr1-full.jpg",
    args: ["-q:v", "4"],
  },
];

function runFfmpeg(outPath, extraArgs) {
  const res = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-i", srcPng, ...extraArgs, outPath],
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    throw new Error(`ffmpeg failed for ${outPath}: ${res.stderr || res.stdout}`);
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const { file, args } of outputs) {
    const outPath = path.join(outDir, file);
    runFfmpeg(outPath, args);
    const { size } = await stat(outPath);
    if (size >= 1_000_000) {
      throw new Error(`${file} is ${size} bytes (must be <1MB)`);
    }
    console.log(`${file}: ${size} bytes`);
  }
  console.log(`Wrote compressed evidence to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
