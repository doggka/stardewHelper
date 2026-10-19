import { ALL } from '../state';
import { SDV_NAMES } from '../data/names';

export const norm = (s: string): string =>
  String(s).toLowerCase().replace(/ё/g, 'е').replace(/[«»"'`]/g, '')
    .replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim();

const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const RU = 'йцукенгшщзхъфывапролджэячсмитьбю';

/** Перевод строки из QWERTY в ЙЦУКЕН — для случая «забыл переключить раскладку». */
export function layout(s: string): string {
  let o = '';
  for (const ch of String(s).toLowerCase()) {
    const i = EN.indexOf(ch);
    o += i >= 0 ? RU[i] : ch;
  }
  return o;
}

/** Расстояние Левенштейна. 99 — заведомо «не похоже», чтобы не считать зря. */
export function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev: number[] = [], cur: number[] = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const BUNDLE_NAMES = Array.from(new Set(ALL.map((i) => i.n)));
export const KNOWN: string[] = SDV_NAMES.concat(BUNDLE_NAMES);
const KNOWN_NORM = KNOWN.map(norm);

export function knownItem(q: string): string | null {
  const i = KNOWN_NORM.indexOf(q);
  return i >= 0 ? KNOWN[i] : null;
}

/**
 * Поиск по названию. Раньше узелки искались по подстроке, а база предметов —
 * только по точному совпадению, поэтому «анч» не находил «Анчоус»: срабатывал
 * лишь разбор опечаток, и то случайно. Теперь обе части ищутся одинаково.
 *
 * Порядок: сначала то, что нужно для узелков (ради этого приложение и писалось),
 * затем остальная база; совпадение с начала названия выше совпадения в середине,
 * короткие названия выше длинных.
 */
export function findNames(q: string, limit = 12): string[] {
  if (q.length < 2) return [];
  const inBundles = new Set(BUNDLE_NAMES.map(norm));
  const scored: [string, number][] = [];
  const seen = new Set<string>();

  for (let i = 0; i < KNOWN.length; i++) {
    const n = KNOWN_NORM[i];
    const at = n.indexOf(q);
    if (at < 0) continue;
    const name = KNOWN[i];
    if (seen.has(name)) continue;
    seen.add(name);
    // меньше — выше
    const rank = (inBundles.has(n) ? 0 : 100) + (at === 0 ? 0 : 10) + Math.min(n.length, 9);
    scored.push([name, rank]);
  }
  scored.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], 'ru'));
  return scored.slice(0, limit).map((x) => x[0]);
}

export function suggest(q: string): string[] {
  const lim = q.length <= 5 ? 1 : q.length <= 9 ? 2 : 3;
  const out: [string, number][] = [];
  for (let i = 0; i < KNOWN.length; i++) {
    const d = lev(q, KNOWN_NORM[i]);
    if (d <= lim) out.push([KNOWN[i], d]);
  }
  out.sort((a, b) => a[1] - b[1] || a[0].length - b[0].length);
  const seen: Record<string, 1> = {}, res: string[] = [];
  out.forEach((x) => {
    if (!seen[x[0]]) {
      seen[x[0]] = 1;
      res.push(x[0]);
    }
  });
  return res.slice(0, 6);
}
