// Общая сборка разметки. Направления отличаются только CSS и парой флагов,
// чтобы разница была именно в оформлении.
window.build = function (opt) {
  const S = window.SAMPLE, T = window.LVL_TEXT;
  const chip = (c) => '<span class="b ' + c.t + '">' + c.v + '</span>';

  const item = (it) =>
    '<div class="item">'
    + '<div class="irow"><label class="ipick"><input type="checkbox">'
    + '<span class="iname">' + it.n + ' <span class="tag">— ' + it.b + '</span></span></label>'
    + '<button class="dot">?</button></div>'
    + '<div class="ibody"><div class="badges">'
    + '<span class="b ' + it.lvl + '">' + T[it.lvl] + '</span>'
    + (it.chips || []).map(chip).join('')
    + '</div>'
    + (it.warn ? '<div class="warn">⚠ ' + it.warn + '</div>' : '')
    + '</div></div>';

  const bundleCard = () => {
    const b = S.bundle;
    return '<div class="bundle"><h3>' + b.name + '<span class="b g">' + b.done + '/' + b.total + '</span></h3>'
      + '<div class="meta">Награда: ' + b.reward + ' · реально закрыть: ' + b.when + '</div>'
      + '<div class="bar"><i style="width:' + (b.done / b.total * 100) + '%"></i></div>'
      + '<ul class="items">' + b.items.map((i) =>
        '<li><div class="item' + (i.ok ? ' ok' : '') + '">'
        + '<div class="irow"><label class="ipick"><input type="checkbox"' + (i.ok ? ' checked' : '') + '>'
        + '<span class="iname">' + i.n + '</span></label><button class="dot">?</button></div>'
        + '<div class="ibody"><div class="badges"><span class="b ' + i.lvl + '">' + T[i.lvl] + '</span></div></div>'
        + '</div></li>').join('')
      + '</ul></div>';
  };

  const chips = Object.keys(S.counts).map((k) =>
    '<button class="b ' + k + (k === 'now' ? ' sel' : '') + (S.counts[k] === 0 ? ' zero' : '') + '">'
    + (k === 'now' ? '✓ ' : '') + T[k] + '<span class="cnt">' + S.counts[k] + '</span></button>').join('');

  const tabs = [['⚠ Не продолбать', '— закрывается в этом сезоне', true], ['Комнаты'], ['План по сезонам'],
    ['🛒 Торговка'], ['Доступно сейчас']]
    .map(([n, sub, on]) => '<button' + (on ? ' class="on"' : '') + '>' + n
      + (sub ? ' <small>' + sub + '</small>' : '') + '</button>').join('');

  return ''
    + '<div class="titlebar"><div class="ttl">' + (opt.brand || '🌱 Stardew Helper')
    + ' <span class="sub">— узелки Общественного центра</span></div><div class="spacer"></div>'
    + '<button class="wbtn">—</button><button class="wbtn">▢</button><button class="wbtn close">✕</button></div>'
    + '<div class="shell"><header>'
    + '<h1>' + (opt.h1 || 'Закрыть за первый год') + ' <small>— 30 узелков Общественного центра</small></h1>'
    + '<div class="savebar"><span class="sb-name">🌱 ' + S.farm + '</span>'
    + '<span class="sb-meta">' + S.player + ' · ' + S.season + ', день ' + S.day + ', год ' + S.year + '</span>'
    + '<span class="sb-meta">отмечено 3</span><span class="sb-sp"></span>'
    + '<button>↻ Обновить из сейва</button><button>Сменить сейв</button></div>'
    + '<div class="row">'
    + '<div class="ctl"><label>Сезон</label><select><option>Весна</option></select>'
    + '<label>день</label><input type="number" value="6" style="width:52px"></div>'
    + '<div class="ctl"><label>Погода</label><div class="seg">'
    + '<button class="on">☀ Ясно</button><button>☔ Дождь</button></div></div>'
    + '<div class="cartday">' + S.weekday + ' · 🛒 ' + S.cart + '</div>'
    + '<div class="ctl grow"><label>Узелки</label><span class="num">' + S.progress[0] + '/' + S.progress[1] + '</span>'
    + '<div class="bar"><i style="width:10%"></i></div></div>'
    + '<div class="ctl"><input type="search" placeholder="название предмета"></div>'
    + '</div>'
    + '<div class="tabs">' + tabs + '</div>'
    + '</header><main>'
    + '<div class="legend">' + chips + '</div>'
    + '<div class="panel"><h2>⏳ Последний сезон сбора <em>— весна; дальше только торговка или 2-й год</em></h2>'
    + '<ul class="flat">' + S.items.map((i) => '<li>' + item(i) + '</li>').join('') + '</ul></div>'
    + '<div class="panel"><h2 class="room">Комната искусств <span>0/6 · награда: Ремонт моста к карьеру</span></h2>'
    + '<div class="grid">' + bundleCard() + bundleCard() + '</div></div>'
    + '</main></div>';
};
