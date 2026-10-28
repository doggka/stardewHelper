import type { Item } from '../types';
import { DOW, SEASON_RU } from '../data/constants';
import { FESTIVALS } from '../data/festivals';
import { ALL, S } from '../state';
import { bprog, done, dow } from '../logic/status';
import { covered } from '../logic/have';
import { esc } from '../ui/html';

/**
 * Календарь сезона: 28 дней сеткой.
 *
 * Всё, что раньше приходилось держать в голове или вспоминать по строке
 * в «Дне», видно сразу: когда праздник, когда приезжает торговка, когда
 * крайний день посадки. Сезона достаточно — дальше загадывать незачем,
 * в игре всё равно всё меняется.
 */

const CART_DAYS = [5, 7, 12, 14, 19, 21, 26, 28];

interface Mark {
  /** праздник */
  fest?: string;
  /** нужна подготовка */
  prep?: boolean;
  cart?: boolean;
  /** крайние дни посадки: названия культур */
  plant?: string[];
}

function marks(): Map<number, Mark> {
  const m = new Map<number, Mark>();
  const at = (d: number): Mark => {
    let x = m.get(d);
    if (!x) { x = {}; m.set(d, x); }
    return x;
  };

  for (const f of FESTIVALS) {
    if (f.season !== S.season) continue;
    for (let i = 0; i < (f.days ?? 1); i++) {
      const x = at(f.day + i);
      x.fest = f.name;
      x.prep = !!f.prep && f.prep !== 'готовиться не надо';
    }
  }

  // Ночной рынок и Пустынный фестиваль заменяют обычные дни торговки,
  // но сама торговка в эти дни тоже работает — отмечаем и то, и другое
  for (const d of CART_DAYS) at(d).cart = true;

  // крайний день посадки: после него культура не успеет вырасти
  ALL.forEach((it: Item) => {
    if (!it.grow || !it.s || it.bundle.room.extra) return;
    if (it.s.indexOf(S.season) < 0) return;
    if (done(it) || bprog(it.bundle).ok || covered(it)) return;
    const last = 28 - it.grow;
    if (last < 1) return;
    const x = at(last);
    if (!x.plant) x.plant = [];
    if (x.plant.indexOf(it.n) < 0) x.plant.push(it.n);
  });

  return m;
}

export function renderCalendar(): string {
  const m = marks();
  const today = S.day;

  let cells = '';
  for (let d = 1; d <= 28; d++) {
    const x = m.get(d) ?? {};
    const cls = ['cday'];
    if (d === today) cls.push('now');
    if (d < today) cls.push('past');
    if (x.fest) cls.push(x.prep ? 'fest prep' : 'fest');

    let body = '';
    if (x.fest) body += '<span class="cfest">' + esc(x.fest) + '</span>';
    if (x.cart) body += '<span class="ccart" title="Странствующая торговка">🛒</span>';
    if (x.plant) {
      body += '<span class="cplant" title="Крайний день посадки: '
        + esc(x.plant.join(', ')) + '">🌱 ' + esc(x.plant[0])
        + (x.plant.length > 1 ? ' +' + (x.plant.length - 1) : '') + '</span>';
    }

    cells += '<div class="' + cls.join(' ') + '">'
      + '<span class="cnum">' + d + '</span>' + body + '</div>';
  }

  const head = DOW.map((n) => '<div class="chead">' + n.slice(0, 2) + '</div>').join('');

  return '<div class="panel"><h2 class="room">' + SEASON_RU[S.season]
    + ' <span>день ' + today + ' · ' + DOW[dow(today)].toLowerCase() + '</span></h2>'
    + '<div class="cal">' + head + cells + '</div>'
    + '<p class="note">🛒 — торговка в Пепельносмольном лесу · 🌱 — крайний день посадки, '
    + 'позже не успеет вырасти в этом сезоне · оранжевым — праздники, к которым надо готовиться</p>'
    + festPrep() + '</div>';
}


/** Что именно взять на ближайший праздник сезона, которому нужна подготовка. */
function festPrep(): string {
  const need = FESTIVALS.filter((f) => f.season === S.season && f.prep
    && f.prep !== 'готовиться не надо' && f.day + (f.days ?? 1) - 1 >= S.day);
  if (!need.length) return '';
  return '<div class="fprep"><h3>К чему готовиться</h3>'
    + need.map((f) => '<p><b>' + esc(f.name) + ', ' + f.day + ' '
      + SEASON_RU[f.season].toLowerCase() + '</b><br>' + esc(f.prep!) + '</p>').join('')
    + '</div>';
}

