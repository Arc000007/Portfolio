import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'index.html', 'style.css', 'main.js', 'Archit_VIT.pdf',
  'assets/profile.jpg', 'assets/innerve.webp', 'assets/morpheus.webp',
];

// Explicit publishing list keeps source photos, backups and QA files private.
const html = await readFile(resolve(root, 'index.html'), 'utf8');
for (const [, path] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(?:https?:|mailto:|tel:|data:|#)/.test(path)) continue;
  if (!files.includes(path)) throw new Error(`Unlisted local asset: ${path}`);
}
for (const file of files) {
  const target = resolve(root, 'dist', file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(root, file), target);
}
console.log(`Built ${files.length} static files in dist/`);
