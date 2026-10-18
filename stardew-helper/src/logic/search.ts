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
