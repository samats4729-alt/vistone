/* VISTONE — страница «Подбор сочетаний»: выбор плит, вид в интерьере, оценка и подсказки.
   Правила оценки — в match.js, тот же код считает блок «С чем сочетается» в карточке коллекции. */
(function () {
  'use strict';

  var M = window.VistoneMatch;
  var root = document.querySelector('[data-combine]');
  var dataEl = document.getElementById('page-data');
  if (!root || !M || !dataEl) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var data = JSON.parse(dataEl.textContent);
  var items = data.items.map(M.prepare);
  var byId = {}, bySlug = {};
  items.forEach(function (it, i) { it.index = i; byId[it.id] = it; bySlug[it.slug] = it; });

  var MAX = 4;
  var sel = (data.selected || []).map(function (s) { return bySlug[s]; }).filter(Boolean)
    .filter(function (it, i, a) { return a.indexOf(it) === i; }).slice(0, MAX).map(function (it) { return it.id; });
  var view = 'room';

  var slots = $('#combo-slots'), result = $('#combo-result'), suggestBox = $('#combo-suggest');
  var grid = $('#pick-grid'), picks = $$('.pick', grid);
  var search = $('#pick-search'), seriesSel = $('#pick-series'), sortSel = $('#pick-sort');
  var count = $('#combo-count'), clearBtn = $('#combo-clear');

  function selected() { return sel.map(function (id) { return byId[id]; }); }

  /** Фон-образец: фото плиты, под ним — тон, пока фото грузится. */
  function bg(it) {
    return 'background-color:' + esc(it.tone) + (it.img ? ';background-image:url(\'' + esc(it.img) + '\')' : '');
  }
  function fit(v) { return '<span class="fit fit-' + v.key + '">' + esc(v.short) + '</span>'; }

  function add(id) {
    if (sel.indexOf(id) >= 0) return;
    if (sel.length >= MAX) { flash('Можно выбрать до ' + MAX + ' материалов — уберите один из подборки.'); return; }
    sel.push(id);
    render();
  }
  function remove(id) {
    sel = sel.filter(function (x) { return x !== id; });
    render();
  }

  var flashTimer = null;
  function flash(msg) {
    var el = $('#combo-flash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'combo-flash';
      el.className = 'combo-flash';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2600);
  }

  /* ---------------------------------------------------------- подборка */
  function renderSlots(roles) {
    var roleOf = {};
    roles.forEach(function (r) { roleOf[r.item.id] = r; });
    var n = Math.min(MAX, Math.max(2, sel.length + 1));
    var html = '';
    for (var i = 0; i < n; i++) {
      var it = byId[sel[i]];
      if (!it) {
        html += '<button type="button" class="slot slot-empty" data-to-picker><span class="slot-plus">+</span>' +
          (i === 0 ? 'Выберите первый материал' : 'Добавить материал') + '</button>';
        continue;
      }
      var r = roleOf[it.id];
      html += '<div class="slot">' +
        '<div class="slot-img" style="' + bg(it) + '">' +
        '<button type="button" class="slot-remove" data-remove="' + esc(it.id) + '" aria-label="Убрать «' + esc(it.name) + '»">×</button>' +
        (sel.length > 1 && r ? '<span class="slot-role">' + esc(r.name) + ' · ' + r.share + '%</span>' : '') +
        '</div>' +
        '<div class="slot-body">' +
        (it.series ? '<p class="card-series">' + esc(it.series) + '</p>' : '') +
        '<p class="slot-name"><a href="/catalog/' + esc(it.slug) + '">' + esc(it.name) + '</a></p>' +
        '<p class="slot-meta">' + esc([it.type, it.finish].filter(Boolean).join(' · ')) + '</p>' +
        '<p class="slot-tone"><i class="dot" style="background:' + esc(it.tone) + '"></i>' + esc(M.describe(it)) +
        (it.vein ? '<i class="dot" style="background:' + esc(it.vein) + '" title="Цвет рисунка"></i>' : '') + '</p>' +
        '<p class="slot-meta">Рисунок: ' + esc(it.patternName) + '</p>' +
        '</div></div>';
    }
    slots.innerHTML = html;
    count.textContent = sel.length + ' из ' + MAX;
    clearBtn.hidden = !sel.length;
  }

  /* ---------------------------------------------------------- как это выглядит */
  function surfaces(roles) {
    var base = roles[0].item, accent = roles[roles.length - 1].item;
    var floor = roles.length >= 3 ? roles[1].item : base;
    var panel = roles.length === 4 ? roles[2].item : null;
    var legend = roles.length >= 3
      ? [['Стены', base], ['Пол', floor]]
      : [['Стены и пол', base]];
    if (panel) legend.push(['Панель на стене', panel]);
    legend.push(['Остров', accent]);
    return { base: base, floor: floor, panel: panel, accent: accent, legend: legend };
  }

  function scene(roles) {
    var s = surfaces(roles);
    return '<div class="scene" role="img" aria-label="Материалы в интерьере: ' + esc(s.legend.map(function (l) { return l[0] + ' — ' + l[1].name; }).join(', ')) + '">' +
      '<div class="scene-wall" style="' + bg(s.base) + '"></div>' +
      (s.panel ? '<div class="scene-panel" style="' + bg(s.panel) + '"></div>' : '') +
      '<div class="scene-floor"><div class="scene-floor-plane" style="' + bg(s.floor) + '"></div></div>' +
      '<div class="scene-island"><div class="island-top" style="' + bg(s.accent) + '"></div><div class="island-front" style="' + bg(s.accent) + '"></div></div>' +
      '</div>' +
      '<ul class="legend">' + s.legend.map(function (l) {
        return '<li><i class="dot" style="background:' + esc(l[1].tone) + '"></i><span>' + esc(l[0]) + '</span><b>' + esc(l[1].name) + '</b></li>';
      }).join('') + '</ul>';
  }

  function side(roles) {
    return '<div class="side-board">' + roles.map(function (r) {
      return '<div class="side-strip" style="flex-grow:' + r.share + ';' + bg(r.item) + '">' +
        '<span class="side-label">' + esc(r.name) + ' · ' + r.share + '%<b>' + esc(r.item.name) + '</b></span></div>';
    }).join('') + '</div>' +
      '<p class="muted small">Ширина полос — по правилу 60/30/10: основной материал занимает большую часть, акцент — меньшую.</p>';
  }

  /* ---------------------------------------------------------- оценка */
  var NOTE_ICON = { good: '✓', info: '•', warn: '!', bad: '✕' };
  function notesHtml(list) {
    return '<ul class="notes">' + list.map(function (n) {
      return '<li class="note-' + n.kind + '"><span class="note-icon" aria-hidden="true">' + NOTE_ICON[n.kind] + '</span><span>' + esc(n.text) + '</span></li>';
    }).join('') + '</ul>';
  }

  function groupNotes(g) {
    if (g.pairs.length === 1) return g.pairs[0].result.notes;
    var list = g.notes.slice(), seen = {};
    g.pairs.forEach(function (p) {
      p.result.notes.forEach(function (n) {
        if (n.kind === 'bad' || n.kind === 'warn') list.push({ kind: n.kind, text: p.a.name + ' + ' + p.b.name + ': ' + n.text });
      });
    });
    // Плюсы — без повторов, чтобы не перечислять одно и то же для каждой пары.
    var goods = [];
    g.pairs.forEach(function (p) {
      p.result.notes.forEach(function (n) {
        if (n.kind === 'good' && !seen[n.text] && goods.length < 3) {
          seen[n.text] = 1;
          goods.push({ kind: n.kind, text: p.a.name + ' + ' + p.b.name + ': ' + n.text });
        }
      });
    });
    var order = { bad: 0, warn: 1, good: 2, info: 3 };
    return list.concat(goods).sort(function (x, y) { return order[x.kind] - order[y.kind]; });
  }

  function shareText(g, roles) {
    var lines = ['Здравствуйте! Подборка материалов с сайта:'];
    roles.forEach(function (r, i) {
      lines.push((i + 1) + '. ' + r.item.name + (r.item.article ? ' (' + r.item.article + ')' : '') + ' — ' + r.name.toLowerCase() + ', ' + r.where);
    });
    if (g) lines.push('Оценка сайта: ' + g.verdict.label);
    lines.push('Ссылка на подборку: ' + location.href);
    lines.push('Подскажите наличие и цену.');
    return lines.join('\n');
  }

  function renderResult(g, roles) {
    if (!sel.length) {
      result.innerHTML = '<div class="combo-intro">' +
        '<h2 class="h3">Как сайт оценивает сочетание</h2>' +
        '<ul class="rules">' +
        '<li><b>Светлота.</b> Материалы либо заметно светлее и темнее друг друга, либо точно в тон. «Почти совпало» смотрится как ошибка.</li>' +
        '<li><b>Подтон.</b> Тёплый с тёплым, холодный с холодным. Белый, серый и чёрный без оттенка подходят ко всему.</li>' +
        '<li><b>Рисунок.</b> Один выразительный рисунок — мрамор или терраццо, остальные материалы спокойнее.</li>' +
        '<li><b>Материал и фактура.</b> Камень с деревом — классика, два разных дерева в один тон — частая ошибка. Разная фактура поверхности даёт глубину.</li>' +
        '</ul>' +
        '<p class="muted small">Оценка — подсказка по правилам дизайна интерьера. Цвет на экране зависит от монитора и фото — окончательно проверяйте на образцах в шоуруме.</p>' +
        '</div>';
      return;
    }
    if (sel.length === 1) {
      result.innerHTML = '<p class="note">Добавьте ещё один материал — ниже подобрано, что хорошо подойдёт к «' + esc(byId[sel[0]].name) + '». ' +
        'Отметки на плитках показывают, как каждый материал сочетается с выбранным.</p>';
      return;
    }
    var wa = data.wa ? 'https://wa.me/' + data.wa + '?text=' + encodeURIComponent(shareText(g, roles)) : '';
    result.innerHTML = '<div class="combo-result">' +
      '<div class="combo-visual">' +
      '<div class="view-tabs">' +
      '<button type="button" data-view="room" aria-pressed="' + (view === 'room') + '">В интерьере</button>' +
      '<button type="button" data-view="side" aria-pressed="' + (view === 'side') + '">Образцы рядом</button>' +
      '</div>' +
      (view === 'room' ? scene(roles) : side(roles)) +
      '</div>' +
      '<div class="combo-verdict">' +
      '<p class="verdict verdict-' + g.verdict.key + '"><span class="meter" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' + esc(g.verdict.label) + '</p>' +
      notesHtml(groupNotes(g)) +
      (g.pairs.length > 1 ? '<div class="combo-sub"><p class="combo-sub-title">По парам</p><ul class="pair-list">' + g.pairs.map(function (p) {
        return '<li><span>' + esc(p.a.name) + ' + ' + esc(p.b.name) + '</span>' + fit(p.result.verdict) + '</li>';
      }).join('') + '</ul></div>' : '') +
      '<div class="combo-sub"><p class="combo-sub-title">Как распределить</p><ul class="role-list">' + roles.map(function (r) {
        return '<li><span class="role-share"><i style="width:' + r.share + '%"></i></span><span class="role-name">' + esc(r.name) + ' · ' + r.share + '%</span>' +
          '<b>' + esc(r.item.name) + '</b><span class="muted">' + esc(r.where) + '</span></li>';
      }).join('') + '</ul></div>' +
      '<div class="actions">' +
      (wa ? '<a class="btn btn-primary" href="' + esc(wa) + '" target="_blank" rel="noopener">Отправить подборку менеджеру</a>'
        : '<button class="btn btn-primary" type="button" data-contact>Обсудить подборку с менеджером</button>') +
      '<button class="btn" type="button" data-copy>Скопировать ссылку</button>' +
      '</div>' +
      '<p class="muted small">Оценка — подсказка по правилам дизайна интерьера. Цвет на экране зависит от монитора и фото — окончательно проверяйте на образцах в шоуруме.</p>' +
      '</div></div>';
  }

  /* ---------------------------------------------------------- подсказки и отметки на плитках */
  function renderSuggest(list) {
    if (!sel.length || sel.length >= MAX || !list.length) { suggestBox.hidden = true; suggestBox.innerHTML = ''; return; }
    suggestBox.hidden = false;
    suggestBox.innerHTML = '<div class="combo-head"><h2 class="h3">Подойдёт к подборке</h2><span class="combo-count">Лучшие пары по правилам сочетания</span></div>' +
      '<div class="pick-grid pick-grid-suggest">' + list.map(function (s) {
        var it = s.item;
        return '<button type="button" class="pick" data-add="' + esc(it.id) + '">' +
          '<span class="pick-img" style="' + bg(it) + '"><span class="pick-plus" aria-hidden="true">+</span></span>' +
          '<span class="pick-name">' + esc(it.name) + '</span>' +
          '<span class="pick-meta">' + esc([it.type, it.finish].filter(Boolean).join(' · ')) + '</span>' +
          fit(s.verdict) + '</button>';
      }).join('') + '</div>';
  }

  function renderPicker(rank) {
    var q = (search.value || '').trim().toLowerCase(), s = seriesSel.value, shown = 0;
    picks.forEach(function (b) {
      var id = b.dataset.id, on = sel.indexOf(id) >= 0;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-full', !on && sel.length >= MAX);
      var chip = $('[data-fit]', b), r = rank[id];
      if (r && !on) {
        chip.hidden = false;
        chip.className = 'fit fit-' + r.verdict.key;
        chip.textContent = r.verdict.short;
      } else if (on) {
        chip.hidden = false;
        chip.className = 'fit fit-on';
        chip.textContent = 'В подборке';
      } else chip.hidden = true;
      var ok = (!q || b.dataset.search.indexOf(q) >= 0) && (!s || b.dataset.series === s);
      b.hidden = !ok;
      if (ok) shown += 1;
    });
    $('#pick-empty').hidden = shown > 0;
    var byMatch = sortSel.value === 'match' && sel.length;
    picks.slice().sort(function (a, b) {
      if (byMatch) {
        var ra = rank[a.dataset.id], rb = rank[b.dataset.id];
        var sa = ra ? ra.score : 101, sb = rb ? rb.score : 101;
        if (sa !== sb) return sb - sa;
      }
      return byId[a.dataset.id].index - byId[b.dataset.id].index;
    }).forEach(function (b) { grid.appendChild(b); });
  }

  /* ---------------------------------------------------------- плашка внизу экрана */
  var bar = document.createElement('div');
  bar.className = 'combo-bar';
  bar.hidden = true;
  document.body.appendChild(bar);
  var resultVisible = false;
  function renderBar(g) {
    if (!sel.length || resultVisible) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML = '<div class="wrap combo-bar-row"><span class="combo-bar-thumbs">' + selected().map(function (it) {
      return '<i style="' + bg(it) + '"></i>';
    }).join('') + '</span><span class="combo-bar-text">' +
      (g ? '<span class="fit fit-' + g.verdict.key + '">' + esc(g.verdict.label) + '</span>' : 'Выбран 1 материал') +
      '</span><button class="btn btn-primary btn-sm" type="button" data-to-result>Смотреть</button></div>';
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      resultVisible = entries[0].isIntersecting;
      renderBar(lastGroup);
    }, { threshold: 0.15 }).observe(result);
  }

  /* ---------------------------------------------------------- всё вместе */
  var lastGroup = null, lastRank = {};
  function render() {
    var list = selected();
    var g = list.length >= 2 ? M.group(list) : null;
    var roles = list.length ? M.roles(list) : [];
    lastGroup = g;
    renderSlots(roles);
    renderResult(g, roles);
    lastRank = list.length && list.length < MAX ? M.rank(list, items) : {};
    renderSuggest(list.length ? M.suggest(list, items, { limit: 6, perSeries: 2 }) : []);
    renderPicker(lastRank);
    renderBar(g);
    var qs = list.map(function (it) { return encodeURIComponent(it.slug); }).join(',');
    history.replaceState(null, '', location.pathname + (qs ? '?m=' + qs : ''));
  }

  function scrollToEl(el) {
    var top = el.getBoundingClientRect().top + (window.pageYOffset || 0) - 90;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    var b;
    if ((b = t.closest('[data-remove]'))) { remove(b.dataset.remove); return; }
    if ((b = t.closest('[data-add]'))) { add(b.dataset.add); return; }
    if ((b = t.closest('#pick-grid .pick'))) {
      var id = b.dataset.id;
      if (sel.indexOf(id) >= 0) remove(id); else add(id);
      return;
    }
    if ((b = t.closest('[data-view]'))) { view = b.dataset.view; render(); return; }
    if (t.closest('[data-to-picker]')) { scrollToEl($('#combo-picker')); return; }
    if (t.closest('[data-to-result]')) { scrollToEl(sel.length >= 2 ? result : slots); return; }
    if (t.closest('[data-copy]')) {
      var url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { flash('Ссылка на подборку скопирована'); }, function () { window.prompt('Скопируйте ссылку', url); });
      } else window.prompt('Скопируйте ссылку', url);
    }
  });
  clearBtn.addEventListener('click', function () { sel = []; render(); });
  var refreshPicker = function () { renderPicker(lastRank); };
  search.addEventListener('input', refreshPicker);
  seriesSel.addEventListener('change', refreshPicker);
  sortSel.addEventListener('change', refreshPicker);

  render();
})();
