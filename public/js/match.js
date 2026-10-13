/* VISTONE — подбор сочетаний материалов.
   Один и тот же код работает в браузере (страница «Подбор сочетаний») и на сервере (блок «С чем сочетается»).

   Правила — из практики дизайна интерьеров:
   1. Светлота: материалы либо заметно различаются по светлоте, либо точно в тон.
      Хуже всего «почти совпало» — одинаковая светлота при разном оттенке.
   2. Подтон: тёплый с тёплым, холодный с холодным; нейтральный (белый, серый, чёрный) — с любым.
   3. Цвет: один яркий цвет — акцент, два ярких — перегруз.
   4. Рисунок: один выразительный рисунок (мрамор, терраццо), остальные спокойнее.
   5. Материалы: камень + дерево — классика; два разных дерева в один тон — частая ошибка.
   6. Фактура: разная фактура поверхности даёт глубину.
   7. Пропорции 60/30/10: основной материал, дополнительный, акцент. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VistoneMatch = factory();
}(this, function () {
  'use strict';

  /* ---------------------------------------------------------- цвет */
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /** sRGB → CIELAB (D65): L — светлота 0…100, a и b — оттенок. */
  function rgbToLab(r, g, b) {
    function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    function f(t) { return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116; }
    var R = lin(r), G = lin(g), B = lin(b);
    var X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    var Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    var Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  }

  function labToHex(L, a, b) {
    function inv(t) { var t3 = t * t * t; return t3 > 216 / 24389 ? t3 : (116 * t - 16) / (24389 / 27); }
    function gam(c) {
      c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
      return Math.max(0, Math.min(255, Math.round(c * 255)));
    }
    var fy = (L + 16) / 116;
    var X = inv(fy + a / 500) * 0.95047, Y = inv(fy), Z = inv(fy - b / 200) * 1.08883;
    var rgb = [
      3.2406 * X - 1.5372 * Y - 0.4986 * Z,
      -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
      0.0557 * X - 0.2040 * Y + 1.0570 * Z,
    ];
    return '#' + rgb.map(function (c) { var h = gam(c).toString(16); return h.length < 2 ? '0' + h : h; }).join('');
  }

  function hexToLab(hex) {
    var c = hexToRgb(hex) || [185, 182, 174];
    return rgbToLab(c[0], c[1], c[2]);
  }

  function deltaE(p, q) {
    return Math.sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]) + (p[2] - q[2]) * (p[2] - q[2]));
  }

  function hueDiff(h1, h2) {
    var d = Math.abs(h1 - h2) % 360;
    return d > 180 ? 360 - d : d;
  }

  /* ---------------------------------------------------------- свойства материала */

  // Тип материала → семейство и насколько выражен рисунок: 0 — спокойный, 1 — умеренный, 2 — выразительный.
  var FAMILIES = [
    [/однотон|монохром|plain|solid/i, 'solid', 0],
    [/дерев|шпон|дуб|орех|ясен|wood|oak/i, 'wood', 1],
    [/металл|ржав|metal|rust/i, 'metal', 1],
    [/мрамор|оникс|marble|onyx|терраццо|terrazzo/i, 'stone', 2],
    [/пятн|крапин|speckl/i, 'stone', 1],
    [/камен|камн|песчан|травертин|известн|бетон|цемент|гранит|сланец|кварц|stone|sand/i, 'stone', 1],
  ];
  var PATTERNS = { calm: 0, medium: 1, busy: 2 };
  var PATTERN_NAMES = ['спокойный', 'умеренный', 'выразительный'];

  // Отделка поверхности → группа фактуры.
  var TEXTURES = [
    [/глянц|полир|зеркал|глазур|лаппат|lappato|gloss/i, 'shine'],
    [/рельеф|формов|структур|состар|гранул|шерох|накат|рифл/i, 'relief'],
    [/мат|глад/i, 'flat'],
  ];

  function pick(list, text) {
    for (var i = 0; i < list.length; i++) if (list[i][0].test(text || '')) return list[i];
    return null;
  }

  /** Подтон: тёплый (жёлтый, бежевый, коричневый), холодный (голубой, серо-синий), нейтральный — без оттенка. */
  function temperature(L, C, h) {
    if (C < (L < 35 ? 2 : 3)) return 'neutral';
    if (h < 125 || h >= 345) return 'warm';
    if (h >= 165 && h < 300) return 'cool';
    return 'mixed';
  }

  /**
   * Готовит материал к сравнению. На входе — данные с сервера:
   * { id, slug, name, type, finish, tone: '#rrggbb', vein, spread, pattern: ''|'calm'|'medium'|'busy', ... }.
   */
  function prepare(it) {
    if (it && it.lab) return it;
    var m = {};
    for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) m[k] = it[k];
    var lab = hexToLab(m.tone);
    m.lab = lab;
    m.L = lab[0];
    m.C = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
    m.h = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360;
    m.temp = temperature(m.L, m.C, m.h);
    var fam = pick(FAMILIES, m.type);
    m.family = fam ? fam[1] : 'other';
    if (PATTERNS[m.pattern] !== undefined) m.level = PATTERNS[m.pattern];
    else {
      m.level = fam ? fam[2] : 1;
      // Сильный рисунок на фото (крупные контрастные прожилки) — выразительный камень.
      if (m.family === 'stone' && (m.spread || 0) >= 7) m.level = 2;
    }
    var tex = pick(TEXTURES, m.finish);
    m.texture = tex ? tex[1] : '';
    m.patternName = PATTERN_NAMES[m.level];
    return m;
  }

  /** Тон словами: «светлый, тёплый». */
  function describe(m) {
    m = prepare(m);
    var light = m.L >= 88 ? 'очень светлый' : m.L >= 70 ? 'светлый' : m.L >= 45 ? 'средний' : m.L >= 25 ? 'тёмный' : 'очень тёмный';
    var temp = { warm: 'тёплый', cool: 'холодный', neutral: 'нейтральный', mixed: 'сложный оттенок' }[m.temp];
    return light + ', ' + temp + (m.C >= 35 ? ', яркий' : '');
  }

  /* ---------------------------------------------------------- оценка */

  var VERDICTS = [
    [80, 'great', 'Отлично сочетаются', 'Отлично'],
    [65, 'good', 'Хорошо сочетаются', 'Хорошо'],
    [50, 'fair', 'Допустимо, есть нюансы', 'С нюансами'],
    [0, 'poor', 'Лучше не сочетать', 'Не советуем'],
  ];

  function verdict(score) {
    for (var i = 0; i < VERDICTS.length; i++) {
      if (score >= VERDICTS[i][0]) return { key: VERDICTS[i][1], label: VERDICTS[i][2], short: VERDICTS[i][3] };
    }
    return null;
  }

  /**
   * Итог по взвешенным правилам. Замечания ограничивают оценку, чтобы вывод совпадал с объяснением:
   * «Отлично» — только без оговорок; серьёзное нарушение правила — «Лучше не сочетать».
   */
  function finish(parts, notes) {
    var sum = 0, w = 0;
    parts.forEach(function (p) { sum += p[0] * p[1]; w += p[0]; });
    var score = Math.round((sum / w) * 100);
    var bad = 0, warn = 0;
    notes.forEach(function (n) {
      if (n.kind === 'bad') bad += 1;
      if (n.kind === 'warn') warn += 1;
      if (n.cap !== undefined) score = Math.min(score, n.cap);
    });
    if (bad >= 2) score = Math.min(score, 35);
    else if (bad) score = Math.min(score, 49);
    else if (warn >= 2) score = Math.min(score, 64);
    else if (warn) score = Math.min(score, 79);
    var order = { bad: 0, warn: 1, good: 2, info: 3 };
    notes.sort(function (x, y) { return order[x.kind] - order[y.kind]; });
    return {
      score: score,
      verdict: verdict(score),
      notes: notes.map(function (n) { return { kind: n.kind, text: n.text }; }),
    };
  }

  function q(m) { return '«' + m.name + '»'; }
  function lower(s) { return String(s || '').toLowerCase(); }

  /** Сочетаются ли два материала: оценка 0–100, вывод и объяснение по правилам. */
  function pair(a, b) {
    a = prepare(a); b = prepare(b);
    var parts = [], notes = [];
    function add(weight, s, kind, text, cap) {
      parts.push([weight, s]);
      if (text) notes.push({ kind: kind, text: text, cap: cap });
    }
    var dL = Math.abs(a.L - b.L), dE = deltaE(a.lab, b.lab), dh = hueDiff(a.h, b.h);
    var light = a.L >= b.L ? a : b, dark = light === a ? b : a;

    // 1. Светлота: лучше всего заметный, но не предельный контраст.
    if (dE < 5) {
      if (a.family !== b.family || a.level !== b.level) {
        add(0.30, 0.75, 'good', 'Тон в тон: цвет почти одинаковый, а рисунок и фактура разные — спокойное, цельное сочетание.');
      } else {
        add(0.30, 0.3, 'warn', 'Материалы почти одного цвета и характера — рядом они сольются. Для контраста возьмите заметно светлее или темнее.');
      }
    } else if (dL < 8 && dE < 15) {
      add(0.30, 0.2, 'warn', 'Одинаковая светлота, но разный оттенок — рядом это выглядит как «не попали в цвет». Лучше либо точно тон в тон, либо заметно светлее или темнее.', 64);
    } else if (dL < 8) {
      add(0.30, 0.6, 'info', 'Материалы одной светлоты и различаются только цветом — контраст мягкий.');
    } else if (dL < 18) {
      add(0.30, 0.7, 'info', 'Небольшой перепад светлоты — мягкое, нюансное сочетание.');
    } else if (dL < 25) {
      add(0.30, 0.9, 'good', q(light) + ' светлее, ' + q(dark) + ' темнее — материалы читаются отдельно и не спорят.');
    } else if (dL < 55) {
      add(0.30, 1, 'good', q(light) + ' светлее, ' + q(dark) + ' темнее — хороший контраст: материалы читаются отдельно и не спорят.');
    } else {
      add(0.30, 0.85, 'good', 'Сильный контраст светлого и тёмного — графичное, выразительное сочетание.');
    }

    // 2. Подтон
    if (a.temp === 'neutral' && b.temp === 'neutral') {
      add(0.25, 0.9, 'good', 'Оба материала нейтральные, без выраженного подтона — сочетаются без риска.');
    } else if (a.temp === 'neutral' || b.temp === 'neutral') {
      add(0.25, 0.9, 'good', q(a.temp === 'neutral' ? a : b) + ' — нейтрального оттенка, подходит и к тёплым, и к холодным тонам.');
    } else if (a.temp === b.temp && a.temp !== 'mixed') {
      add(0.25, 1, 'good', a.temp === 'warm' ? 'Оба материала тёплого подтона — сочетание цельное.' : 'Оба материала холодного подтона — сочетание цельное.');
    } else if (a.temp === 'mixed' || b.temp === 'mixed') {
      add(0.25, 0.7);
    } else {
      var warm = a.temp === 'warm' ? a : b, cool = warm === a ? b : a;
      if (warm.C >= 10 && cool.C >= 8) {
        add(0.25, 0.1, 'bad', 'Тёплый и холодный подтон спорят: ' + q(warm) + ' уходит в желтизну, ' + q(cool) + ' — в голубизну. Рядом один из них будет казаться грязным.');
      } else {
        add(0.25, 0.4, 'warn', 'Подтоны расходятся: ' + q(warm) + ' тёплый, ' + q(cool) + ' холодный. Разница небольшая — проверьте на образцах при вашем освещении.');
      }
    }

    // 3. Цвет: один насыщенный цвет — акцент, два — перегруз.
    var bright = a.C >= 35 ? a : b.C >= 35 ? b : null;
    if (a.C >= 35 && b.C >= 35 && dh > 30) {
      add(0.10, 0.1, 'bad', 'Два ярких цвета — перегруз. Яркий материал лучше оставить единственным акцентом.');
    } else if (a.C >= 15 && b.C >= 15) {
      if (dh <= 30) add(0.10, 1, 'good', 'Цвета из одной гаммы — близкие оттенки.');
      else if (dh >= 150) add(0.10, 0.6, 'info', 'Контрастные цвета — смелое сочетание; пусть один из них займёт небольшую площадь.', 79);
      else add(0.10, 0.4, 'warn', 'Два выраженных цвета разных оттенков — лучше, чтобы цветным был один материал, а второй — нейтральным.');
    } else if ((a.C >= 25 && b.C < 10) || (b.C >= 25 && a.C < 10)) {
      add(0.10, bright ? 0.8 : 1, 'good', q(a.C >= 25 ? a : b) + ' — цветной акцент на спокойном фоне.');
    } else {
      add(0.10, 0.8);
    }
    if (bright && !(a.C >= 35 && b.C >= 35 && dh > 30)) {
      notes.push({ kind: 'info', text: q(bright) + ' — яркий цвет: эффектно, но только на небольшой площади.', cap: 79 });
    }

    // 4. Рисунок: один главный рисунок, остальные — фон.
    if (a.level === 2 && b.level === 2) {
      add(0.20, 0.1, 'bad', 'Два выразительных рисунка конкурируют за внимание. Оставьте один «главный» рисунок, второй материал — спокойный.');
    } else if (a.level + b.level === 3) {
      add(0.20, 0.65, 'info', 'Главный рисунок — у ' + q(a.level === 2 ? a : b) + ', второй материал тоже с рисунком. Выразительный материал лучше дать на меньшей площади.');
    } else if (a.level === 0 && b.level === 0) {
      add(0.20, 0.7, 'info', 'Оба материала однотонные — сочетание сдержанное; глубину добавит контраст тона или фактуры.');
    } else if (a.level === 0 || b.level === 0) {
      var calm = a.level === 0 ? a : b, other = calm === a ? b : a;
      add(0.20, 1, 'good', 'Спокойный ' + q(calm) + ' не спорит с рисунком ' + q(other) + ' и оттеняет его.');
    } else {
      add(0.20, 0.65, 'info', 'Оба материала с рисунком — хорошо, когда рисунки разного масштаба, например древесное волокно и камень.');
    }

    // 5. Материалы
    if (a.family === 'wood' && b.family === 'wood') {
      if (dL < 20) add(0.10, 0.1, 'bad', 'Два разных дерева близкого тона — частая ошибка: выглядит, будто не подобрали в цвет. Возьмите одно дерево или явно разные — светлое и тёмное.');
      else add(0.10, 0.5, 'warn', 'Два дерева — контраст по тону достаточный; следите, чтобы волокна шли в одном направлении.');
    } else if ((a.family === 'wood' && b.family === 'stone') || (a.family === 'stone' && b.family === 'wood')) {
      add(0.10, 1, 'good', 'Камень и дерево — классическая пара: природные фактуры дополняют друг друга.');
    } else if (a.family === 'metal' && b.family === 'metal') {
      add(0.10, 0.4, 'warn', 'Два металла — интерьер может получиться холодным и тяжёлым.');
    } else if (a.family === 'metal' || b.family === 'metal') {
      add(0.10, 0.95, 'good', 'Металлическая фактура добавляет сочетанию индустриальный акцент.');
    } else if (a.family === 'stone' && b.family === 'stone') {
      add(0.10, lower(a.type) === lower(b.type) ? 0.6 : 0.75);
    } else {
      add(0.10, 0.85);
    }

    // 6. Фактура поверхности
    if (a.texture && b.texture && a.texture !== b.texture) {
      add(0.05, 1, 'good', 'Разная фактура поверхности — ' + lower(a.finish) + ' и ' + lower(b.finish) + ': свет ложится по-разному, появляется глубина.');
    } else if (a.texture && a.texture === b.texture) {
      add(0.05, 0.7, 'info', lower(a.finish) === lower(b.finish)
        ? 'Одинаковая фактура поверхности (' + lower(a.finish) + ') — плоскости будут выглядеть единообразно.'
        : 'Похожая фактура поверхности — плоскости будут выглядеть единообразно.');
    } else {
      add(0.05, 0.8);
    }

    // 7. Цвет рисунка: если второй материал повторяет цвет прожилок — сочетание выглядит продуманным.
    var echo = [[a, b], [b, a]].filter(function (x) { return x[0].vein && deltaE(hexToLab(x[0].vein), x[1].lab) < 10; })[0];
    if (echo) add(0.10, 1, 'good', q(echo[1]) + ' повторяет цвет рисунка ' + q(echo[0]) + ' — сочетание выглядит продуманным.');

    return finish(parts, notes);
  }

  /* ---------------------------------------------------------- подборка из нескольких материалов */

  var ROLE_SETS = {
    1: [['base', 'Основной', 100]],
    2: [['base', 'Основной', 70], ['accent', 'Акцент', 30]],
    3: [['base', 'Основной', 60], ['second', 'Дополнительный', 30], ['accent', 'Акцент', 10]],
    4: [['base', 'Основной', 45], ['second', 'Дополнительный', 25], ['second2', 'Дополнительный', 20], ['accent', 'Акцент', 10]],
  };
  var ROLE_WHERE = {
    base: 'стены и пол — большие площади',
    second: 'мебель, фасады, отдельная зона',
    second2: 'панель, ниша, второй уровень',
    accent: 'остров, столешница, портал',
  };

  /**
   * Роли по правилу 60/30/10: самый спокойный материал — основной, самый яркий по рисунку и цвету — акцент.
   * Возвращает список в порядке ролей: [{ item, key, name, share, where }].
   */
  function roles(items) {
    var list = items.map(prepare).map(function (m, i) {
      return { m: m, i: i, s: m.level * 2 + (m.C >= 25 ? 2 : m.C >= 12 ? 1 : 0) + (m.family === 'metal' ? 1 : 0) };
    });
    list.sort(function (x, y) { return x.s - y.s || y.m.L - x.m.L || x.i - y.i; });
    var set = ROLE_SETS[Math.min(4, Math.max(1, list.length))];
    return list.slice(0, 4).map(function (x, k) {
      var r = set[k];
      return { item: x.m, key: r[0], name: r[1], share: r[2], where: ROLE_WHERE[r[0]] };
    });
  }

  /** Оценка подборки из 2–4 материалов: общий вывод, оценка каждой пары и общие замечания. */
  function group(items) {
    var ms = items.map(prepare);
    if (ms.length < 2) return null;
    var pairs = [];
    for (var i = 0; i < ms.length; i++) {
      for (var j = i + 1; j < ms.length; j++) pairs.push({ a: ms[i], b: ms[j], result: pair(ms[i], ms[j]) });
    }
    if (ms.length === 2) {
      var one = pairs[0].result;
      return { score: one.score, verdict: one.verdict, notes: one.notes, pairs: pairs, roles: roles(ms) };
    }
    var scores = pairs.map(function (p) { return p.result.score; });
    var min = Math.min.apply(null, scores);
    var avg = scores.reduce(function (s, v) { return s + v; }, 0) / scores.length;
    var score = Math.round(0.5 * min + 0.5 * avg);
    var notes = [];
    var Ls = ms.map(function (m) { return m.L; });
    if (Math.max.apply(null, Ls) - Math.min.apply(null, Ls) < 15) {
      notes.push({ kind: 'info', text: 'Все материалы близки по светлоте — спокойный монохром. Для глубины добавьте один заметно светлее или темнее.' });
      score -= 5;
    }
    if (ms.filter(function (m) { return m.C >= 25; }).length >= 2) {
      notes.push({ kind: 'warn', text: 'Несколько насыщенных цветов в одной подборке — оставьте один цветной акцент.' });
      score = Math.min(score, 79);
    }
    if (ms.length >= 4) {
      notes.push({ kind: 'info', text: 'Четыре материала — верхняя граница для одного помещения: один главный, остальные поддерживают.' });
    }
    // Если хоть одна пара не сочетается — вся подборка не может быть хорошей.
    if (min < 50) score = Math.min(score, 49);
    else if (min < 65) score = Math.min(score, 64);
    score = Math.max(0, score);
    return { score: score, verdict: verdict(score), notes: notes, pairs: pairs, roles: roles(ms) };
  }

  /**
   * Насколько каждый материал из all подходит к уже выбранным. Возвращает { id: { score, verdict } }.
   * Считаются только пары «кандидат + выбранный» — если среди выбранных уже есть спорная пара,
   * это не должно портить оценку остальных материалов.
   */
  function rank(selected, all) {
    var sel = selected.map(prepare), ids = {}, out = {};
    sel.forEach(function (m) { ids[m.id] = 1; });
    all.forEach(function (c) {
      if (ids[c.id]) return;
      var scores = sel.map(function (m) { return pair(m, c).score; });
      var min = Math.min.apply(null, scores);
      var avg = scores.reduce(function (s, v) { return s + v; }, 0) / scores.length;
      var score = Math.round(0.5 * min + 0.5 * avg);
      if (min < 50) score = Math.min(score, 49);
      else if (min < 65) score = Math.min(score, 64);
      out[c.id] = { score: score, verdict: verdict(score) };
    });
    return out;
  }

  /**
   * Лучшие пары к выбранным материалам. Чтобы подсказки были разнообразными —
   * не больше perSeries из одной серии; почти одинаковые с выбранными пропускаются.
   */
  function suggest(selected, all, opts) {
    opts = opts || {};
    var limit = opts.limit || 6, perSeries = opts.perSeries || 2;
    var sel = selected.map(prepare);
    var r = rank(sel, all);
    var list = all.map(prepare).filter(function (c) {
      return r[c.id] && !sel.some(function (m) { return deltaE(m.lab, c.lab) < 3 && m.family === c.family; });
    });
    list.sort(function (x, y) { return r[y.id].score - r[x.id].score; });
    var bySeries = {}, out = [];
    for (var i = 0; i < list.length && out.length < limit; i++) {
      var key = list[i].seriesId || list[i].series || '';
      if ((bySeries[key] || 0) >= perSeries) continue;
      bySeries[key] = (bySeries[key] || 0) + 1;
      out.push({ item: list[i], score: r[list[i].id].score, verdict: r[list[i].id].verdict });
    }
    return out;
  }

  return {
    hexToLab: hexToLab, rgbToLab: rgbToLab, labToHex: labToHex, deltaE: deltaE,
    prepare: prepare, describe: describe, pair: pair, group: group, roles: roles, rank: rank, suggest: suggest, verdict: verdict,
    PATTERN_NAMES: PATTERN_NAMES,
  };
}));
