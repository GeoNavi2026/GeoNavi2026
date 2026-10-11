// Copies MapLibre's worker into public/ so the browser can load it.
//
// maplibre-gl 6 resolves its worker URL at runtime from its own module URL,
// which bundlers can't see, so the worker never makes it into the build.
// MapView points MapLibre at these copies with setWorkerUrl(). Runs before
// `dev` and `build`, so the copies always match the installed version.

import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const out = join(import.meta.dirname, "..", "public", "maplibre");

mkdirSync(out, { recursive: true });
// The worker imports the shared chunk by relative path, so both must sit together.
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(out, file));
}
