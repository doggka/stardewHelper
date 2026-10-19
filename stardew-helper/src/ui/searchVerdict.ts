import { LVL } from '../data/constants';
import { ALL, S } from '../state';
import { bprog, cartInfo, done, st } from '../logic/status';
import { findNames, layout, norm, suggest } from '../logic/search';
import { esc, locChips, suggHTML, wikiUrl } from './html';

/**
 * Карточка-вердикт над результатами поиска. Три исхода, разведённые по цвету:
 * нужен для узелков / есть в игре, но не нужен / не нашёл такого.
 */
/** Карточка «предмет есть в игре, но для узелков не нужен». */
function nopeCard(name: string): string {
  return '<div class="panel verdict nope"><h2>⚪ <span class="big">' + esc(name) + '</span> — для узелков не нужен</h2>'
    + '<p class="note" style="font-style:normal">Такой предмет в игре есть, но ни в один узелок Общественного центра он не входит. Можно спокойно продавать, дарить или готовить.</p>'
    + '<button data-ext="' + esc(wikiUrl(name)) + '">статья на вики ↗</button></div>';
}

export function searchVerdict(): string {
  const q = norm(S.q);
  if (!q) return '';
  if (q.length < 2) {
    return '<div class="panel verdict unknown"><h2>Введи хотя бы две буквы</h2>'
      + '<p class="note" style="font-style:normal">По одной букве совпадают сотни названий — толку от такого списка мало.</p></div>';
  }

  // ищем сразу по узелкам и по базе предметов, одинаково — по подстроке
  const found = findNames(q);
  const bundleNames = found.filter((n) => ALL.some((i) => i.n === n));
  const otherNames = found.filter((n) => !bundleNames.includes(n));

  if (!found.length) {
    const lay = norm(layout(q));
    if (lay !== q) {
      const byLay = findNames(lay, 1);
      if (byLay.length) {
        return '<div class="panel verdict unknown"><h2>⌨ Похоже, раскладка не та</h2>'
          + '<p class="note" style="font-style:normal">«' + esc(S.q) + '» в кириллице — это <b>' + esc(lay) + '</b>.</p>'
          + suggHTML(byLay) + '</div>';
      }
    }
    const sg = suggest(q);
    if (sg.length) {
      // подсказка есть — значит это опечатка, а не «не нашёл»
      return '<div class="panel verdict unknown"><h2>Возможно, опечатка</h2>'
        + '<p class="note" style="font-style:normal">Точного совпадения с «' + esc(S.q) + '» нет. Похожие названия:</p>'
        + suggHTML(sg) + '</div>';
    }
    return '<div class="panel verdict unknown"><h2>❓ Не нашёл предмет «' + esc(S.q) + '»</h2>'
      + '<p class="note" style="font-style:normal">Ни в узелках, ни в базе предметов такого названия нет — проверь написание.</p>'
      + '<button data-ext="' + esc(wikiUrl(S.q)) + '">поискать на вики ↗</button></div>';
  }

  // ничего из узелков — значит предмет есть, но не нужен
  if (!bundleNames.length) {
    return nopeCard(otherNames[0])
      + (otherNames.length > 1
          ? '<div class="morefound"><span>Ещё нашлось:</span>' + suggHTML(otherNames.slice(1)) + '</div>'
          : '');
  }

  const hits = ALL.filter((i) => bundleNames.includes(i.n));
  const names = bundleNames;
  let h = '';
  names.slice(0, 4).forEach((nm) => {
    const group = hits.filter((i) => i.n === nm), it = group[0], s = st(it), ci = cartInfo(it);
    const needs = group.map((i) => {
      const b = i.bundle;
      return '<li>' + esc(b.name) + ' <span class="tag">(' + esc(b.room.name) + ')</span> — '
        + (i.q ? i.q + ' шт' : '1 шт') + ', ' + (i.gold ? '<b>золотое качество</b>' : 'любое качество')
        + ', ' + ((b.items || []).length > b.slots ? 'на выбор ' + b.slots + ' из ' + (b.items || []).length : 'обязательный, ' + b.slots + ' из ' + b.slots)
        + (done(i) ? ' — <b style="color:#8ddc8d">уже отмечен ✓</b>' : '') + '</li>';
    }).join('');
    h += '<div class="panel verdict yes"><h2>✅ <span class="big">' + esc(nm) + '</span> — нужен для узелков</h2>'
      + '<ul style="margin:0 0 8px;padding-left:18px;font-size:13px">' + needs + '</ul>'
      + '<div class="badges" style="margin-bottom:8px"><span class="b ' + s.lvl + '">' + LVL[s.lvl] + '</span>'
      + (s.last ? '<span class="b last">⏳ последний сезон сбора</span>' : '')
      + locChips(it) + s.cond.map((c) => '<span class="b g">' + esc(c) + '</span>').join('')
      + (ci.price ? '<span class="b cart">🛒 у торговки ' + ci.price + ' з.</span>' : '<span class="b past">🛒 ' + esc(ci.no) + '</span>')
      + '</div>'
      + '<div class="note" style="font-style:normal">' + esc(it.src || '') + '</div>'
      + (it.warn ? '<div class="warn">⚠ ' + it.warn + '</div>' : '')
      + '<div style="margin-top:8px"><button data-ext="' + esc(wikiUrl(nm)) + '">статья на вики ↗</button></div></div>';
  });
  // остальное — кликабельным списком, а не перечислением через запятую
  const rest = names.slice(4).concat(otherNames);
  if (rest.length) {
    h += '<div class="morefound"><span>Ещё нашлось:</span>' + suggHTML(rest.slice(0, 10)) + '</div>';
  }
  return h;
}

export { bprog };
