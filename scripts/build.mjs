import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'style.css', 'dock.css', 'app.js', 'art-grid.html', 'art-grid.css', 'art-grid.js', 'grid-math.js', 'grid-ink.js', 'artworks.js', 'assets', 'artwork', 'pad']) {
  await cp(path.join(root, file), path.join(output, file), { recursive: true });
}
console.log('Art Room built in dist/ — ready for any static host.');
