/**
 * Проверка парсера имущества на настоящем сейве.
 *
 *   node tools/check-belongings.mjs [путь к файлу сейва]
 *
 * Печатает, что нашлось из предметов узелков: в карманах, в сундуках,
 * на грядках. Нужна, чтобы сверить цифры с тем, что видно в игре, —
 * иначе «у тебя это есть» легко покажет не то и не там.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

async function load(rel) {
  const tmp = path.join(here, '.chk.' + path.basename(rel) + '.mjs');
  await build({
    entryPoints: [path.join(here, '..', rel)],
    outfile: tmp, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent',
    external: ['node:fs', 'node:path', 'node:os'],
  });
  const mod = await import(pathToFileURL(tmp).href);
  fs.rmSync(tmp, { force: true });
  return mod;
}

function newestSave() {
  const root = path.join(os.homedir(), 'AppData', 'Roaming', 'StardewValley', 'Saves');
  const dirs = fs.readdirSync(root)
    .map((d) => path.join(root, d, d))
    .filter((f) => fs.existsSync(f))
    .map((f) => ({ f, t: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return dirs.length ? dirs[0].f : null;
}

const file = process.argv[2] || newestSave();
if (!file) { console.error('Сейв не найден'); process.exit(2); }

const { readBelongings } = await load('electron/belongings.ts');
const { ITEM_IDS } = await load('src/data/itemIds.ts');
const { ROOMS } = await load('src/data/bundles.ts');

const b = readBelongings(file);
if (!b) { console.error('Не прочитался: ' + file); process.exit(1); }

console.log('Сейв: ' + path.basename(file));
console.log('Всего найдено: предметов ' + b.items.length + ', грядок ' + b.crops.length);

// обратная таблица: itemId → названия предметов узелков
const byId = new Map();
ROOMS.forEach((r) => r.bundles.forEach((bu) => (bu.items || []).forEach((it, i) => {
  const id = ITEM_IDS[bu.id + ':' + i];
  if (!id) return;
  if (!byId.has(id)) byId.set(id, []);
  byId.get(id).push(it.n + ' (' + bu.name + ')');
})));

console.log('\n— из узелков в карманах и сундуках:');
const seen = new Map();
b.items.forEach((h) => {
  if (!byId.has(h.id)) return;
  const k = h.id + '|' + h.where + '|' + (h.loc ?? '') + '|' + h.x + ',' + h.y + '|' + h.quality;
  seen.set(k, (seen.get(k) ?? 0) + h.qty);
});
if (!seen.size) console.log('  ничего');
for (const [k, qty] of seen) {
  const [id, where, loc, xy, q] = k.split('|');
  console.log('  ' + byId.get(id)[0] + ' ×' + qty
    + ' — ' + (where === 'bag' ? 'карманы' : 'сундук ' + loc + ' ' + xy)
    + (q !== '0' ? ', качество ' + q : ''));
}

console.log('\n— из узелков растёт на грядках:');
const beds = new Map();
b.crops.forEach((c) => {
  if (!byId.has(c.id)) return;
  const k = c.id + '|' + c.days;
  beds.set(k, (beds.get(k) ?? 0) + 1);
});
if (!beds.size) console.log('  ничего');
for (const [k, n] of beds) {
  const [id, days] = k.split('|');
  console.log('  ' + byId.get(id)[0] + ' — грядок ' + n + ', до сбора ' + days + ' дн.');
}

console.log('\n— всё, что растёт (включая не нужное для узелков):');
const all = new Map();
b.crops.forEach((c) => all.set(c.id, (all.get(c.id) ?? 0) + 1));
for (const [id, n] of all) {
  console.log('  id ' + id + ' ×' + n + (byId.has(id) ? '  ← ' + byId.get(id)[0] : ''));
}
