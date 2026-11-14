// Downloads the Plus Jakarta Sans font once, so the app does not need the internet to look right.
// Needs network. If it fails the app simply uses the system font (nothing breaks).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'www', 'fonts');
mkdirSync(out, { recursive: true });

const css = await (await fetch('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&display=swap', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' }
})).text();
const m = css.match(/url\((https:[^)]+\.woff2)\)/);
if (!m) throw new Error('No woff2 link found in the font CSS');
const buf = Buffer.from(await (await fetch(m[1])).arrayBuffer());
writeFileSync(join(out, 'PlusJakartaSans.woff2'), buf);
console.log('Saved www/fonts/PlusJakartaSans.woff2 (' + Math.round(buf.length / 1024) + ' KB)');
