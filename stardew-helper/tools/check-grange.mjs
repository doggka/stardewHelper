/**
 * Проверка расчёта выставки на настоящем сейве.
 *
 *   node tools/check-grange.mjs
 *
 * Печатает подобранную девятку и очки. Нужна, чтобы сверить расчёт
 * с тем, что начислят судьи: правила взяты с вики, а код игры
 * (Event.judgeGrange) рефлексией не читается.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
async function load(rel, ext) {
  const tmp = path.join(here, '.g' + rel.replace(/\W/g, '') + '.mjs');
  await build({ entryPoints: [path.join(here, '..', rel)], outfile: tmp, bundle: true,
    format: 'esm', platform: 'node', logLevel: 'silent', external: ext });
  const mod = await import(pathToFileURL(tmp).href);
  fs.rmSync(tmp, { force: true });
  return mod;
}

const saves = await load('electron/saves.ts', ['node:fs', 'node:path', 'node:os']);
const bel = await load('electron/belongings.ts', ['node:fs']);
const s = saves.listSaves([saves.DEFAULT_ROOT]).find((x) => x.farmName === 'Пивзавод');
const b = bel.readBelongings(s.file);

console.log('Сейв: ' + s.farmName + ', ' + s.day + ' '
  + ['весна', 'лето', 'осень', 'зима'][s.season] + ', год ' + s.year);
console.log('Профессии: ' + s.farm.professions.join(', ')
  + (s.farm.professions.includes(1) ? ' · Tiller +10%' : '')
  + (s.farm.professions.includes(4) ? ' · Artisan +40%' : ''));

const CATS = [
  { key: 'продукты животных', cats: [-5, -6, -14, -18] },
  { key: 'ремесло', cats: [-26] },
  { key: 'кулинария', cats: [-7] },
  { key: 'рыба', cats: [-4] },
  { key: 'дикоросы и цветы', cats: [-81, -80, -27] },
  { key: 'фрукты', cats: [-79] },
  { key: 'минералы', cats: [-2, -12] },
  { key: 'овощи', cats: [-75] },
];
const POINTS = [
  { from: 400, q: [6, 6, 6, 8] }, { from: 300, q: [5, 6, 6, 8] },
  { from: 200, q: [4, 5, 6, 8] }, { from: 90, q: [3, 4, 5, 7] },
  { from: 20, q: [2, 3, 4, 6] }, { from: 0, q: [1, 2, 3, 5] },
];
const MULT = [1, 1.25, 1.5, 1.5, 2];
const prof = s.farm.professions;
const price = (it) => {
  let p = it.price * (MULT[it.quality] ?? 1);
  if (prof.includes(1) && [-75, -79, -80].includes(it.cat)) p *= 1.1;
  if (prof.includes(4) && it.cat === -26) p *= 1.4;
  return Math.floor(p);
};
const pts = (it) => (POINTS.find((r) => price(it) >= r.from) ?? POINTS[5])
  .q[Math.min(3, it.quality === 4 ? 3 : it.quality)];
const catOf = (it) => CATS.find((c) => c.cats.includes(it.cat))?.key ?? null;

const seen = new Set();
const pool = [];
for (const it of b.items) {
  const k = it.id + '|' + it.quality;
  if (seen.has(k) || !it.price) continue;
  seen.add(k);
  pool.push(it);
}
pool.sort((a, c) => pts(c) - pts(a) || price(c) - price(a));

const picks = [];
const used = new Set();
for (const c of CATS) {
  if (picks.length >= 9) break;
  const best = pool.find((it) => catOf(it) === c.key && !used.has(it.id + '|' + it.quality));
  if (best) { picks.push(best); used.add(best.id + '|' + best.quality); }
}
for (const it of pool) {
  if (picks.length >= 9) break;
  const k = it.id + '|' + it.quality;
  if (!used.has(k)) { picks.push(it); used.add(k); }
}

const Q = ['', ' (серебро)', ' (золото)', '', ' (иридий)'];
console.log('\nДевятка:');
let sum = 0;
for (const p of picks) {
  sum += pts(p);
  console.log('  ' + (p.name + Q[p.quality]).padEnd(28)
    + (catOf(p) ?? 'вне категорий').padEnd(20)
    + String(price(p)).padStart(6) + ' з.   ' + pts(p) + ' оч.');
}
const cats = new Set(picks.map(catOf).filter(Boolean)).size;
const total = 14 + (2 * picks.length - 9) + Math.min(30, cats * 5) + sum;
console.log('\n  участие 14 · предметов ' + (2 * picks.length - 9)
  + ' · категорий ' + cats + ' из 8 → ' + Math.min(30, cats * 5)
  + ' · за предметы ' + sum);
console.log('  ИТОГО: ' + total + ' оч. → '
  + (total >= 90 ? 'первое место' : total >= 75 ? 'второе' : total >= 60 ? 'третье' : 'четвёртое'));
