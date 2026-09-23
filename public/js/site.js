/* VISTONE — поведение сайта: меню, окно контактов, фильтры каталога, калькулятор, галерея. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var nf = new Intl.NumberFormat('ru-RU');
  function money(v) { return nf.format(Math.round(v)) + ' ₸'; }
  function num(v, d) { return Number(v).toLocaleString('ru-RU', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function plural(n, f) { var a = n % 100, b = n % 10; return a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b > 1 && b < 5 ? f[1] : f[2]; }
  var pageData = (function () { var el = $('#page-data'); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } })();

  /* ---------------------------------------------------------- меню */
  var burger = $('.burger'), nav = $('#nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------------------------------------------------------- окно контактов */
  var modal = $('#contact-modal'), lastFocus = null;
  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    var c = $('[data-close]', modal); if (c) c.focus();
  }
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-contact]') : null;
    if (t) { e.preventDefault(); openModal(); return; }
    if (modal && (e.target === modal || (e.target.closest && e.target.closest('[data-close]')))) closeModal();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeFilters(); } });

  /* ---------------------------------------------------------- каталог */
  var grid = $('#grid'), form = $('#filter-form');
  var filters = $('#filters');
  function openFilters() { if (filters) { filters.classList.add('is-open'); document.body.classList.add('no-scroll'); } }
  function closeFilters() { if (filters && filters.classList.contains('is-open')) { filters.classList.remove('is-open'); document.body.classList.remove('no-scroll'); } }

  if (grid && form) {
    var cards = $$('.card', grid);
    var search = $('#search'), sort = $('#sort'), found = $('#found'), empty = $('#empty');

    var checked = function (name) { return $$('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; }); };
    var numVal = function (name) { var i = form.elements[name]; if (!i || i.value === '') return null; var n = Number(i.value); return isFinite(n) ? n : null; };

    function state() {
      return {
        q: (search.value || '').trim().toLowerCase(),
        series: checked('series'), type: checked('type'), color: checked('color'), finish: checked('finish'),
        size: checked('size'), thickness: checked('thickness'), avail: checked('avail').length > 0,
        pmin: numVal('pmin'), pmax: numVal('pmax'), sort: sort.value,
      };
    }
    function any(list, values) { return !list.length || values.some(function (v) { return list.indexOf(v) >= 0; }); }

    function apply() {
      var s = state(), shown = 0;
      cards.forEach(function (c) {
        var d = c.dataset, price = d.price === '' ? null : Number(d.price);
        var ok = (!s.q || d.search.indexOf(s.q) >= 0)
          && any(s.series, [d.series]) && any(s.type, [d.type]) && any(s.color, [d.color]) && any(s.finish, [d.finish])
          && any(s.size, d.sizes ? d.sizes.split('|') : []) && any(s.thickness, d.thickness ? d.thickness.split('|') : [])
          && (!s.avail || d.avail === 'in' || d.avail === 'low')
          && (s.pmin === null || (price !== null && price >= s.pmin))
          && (s.pmax === null || (price !== null && price <= s.pmax));
        c.hidden = !ok;
        if (ok) shown += 1;
      });
      var key = function (c) { return Number(c.dataset.order) || 0; };
      var cmp = {
        '': function (a, b) { return key(a) - key(b); },
        name: function (a, b) { return $('.card-title', a).textContent.localeCompare($('.card-title', b).textContent, 'ru'); },
        'price-asc': function (a, b) { return (a.dataset.price === '' ? Infinity : +a.dataset.price) - (b.dataset.price === '' ? Infinity : +b.dataset.price); },
        'price-desc': function (a, b) { return (b.dataset.price === '' ? -Infinity : +b.dataset.price) - (a.dataset.price === '' ? -Infinity : +a.dataset.price); },
        stock: function (a, b) { return (+b.dataset.stock || 0) - (+a.dataset.stock || 0); },
      }[s.sort] || function (a, b) { return key(a) - key(b); };
      cards.slice().sort(cmp).forEach(function (c) { grid.appendChild(c); });
      found.textContent = 'Найдено: ' + shown + ' ' + plural(shown, ['коллекция', 'коллекции', 'коллекций']);
      empty.hidden = shown > 0;
      var btn = $('.filters-apply'); if (btn) btn.textContent = 'Показать ' + shown;

      var p = new URLSearchParams();
      ['series', 'type', 'color', 'finish', 'size', 'thickness'].forEach(function (k) { if (s[k].length) p.set(k, s[k].join(',')); });
      if (s.avail) p.set('avail', '1');
      if (s.pmin !== null) p.set('pmin', s.pmin);
      if (s.pmax !== null) p.set('pmax', s.pmax);
      if (s.q) p.set('q', s.q);
      if (s.sort) p.set('sort', s.sort);
      var qs = p.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    }

    form.addEventListener('change', apply);
    form.addEventListener('input', function (e) { if (e.target.type === 'number') apply(); });
    search.addEventListener('input', apply);
    sort.addEventListener('change', apply);
    $$('[data-reset]').forEach(function (b) {
      b.addEventListener('click', function () {
        form.reset();
        $$('input', form).forEach(function (i) { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
        search.value = ''; sort.value = '';
        apply();
      });
    });
    $$('[data-filters-open]').forEach(function (b) { b.addEventListener('click', openFilters); });
    $$('[data-filters-close]').forEach(function (b) { b.addEventListener('click', closeFilters); });
    apply();
  }

  /* ---------------------------------------------------------- калькулятор */
  $$('[data-calc]').forEach(function (box) {
    if (!pageData || !pageData.products) return;
    var byId = {}; pageData.products.forEach(function (p) { byId[p.id] = p; });
    var mat = $('[data-calc-material]', box), size = $('[data-calc-size]', box);
    var area = $('[data-calc-area]', box), waste = $('[data-calc-waste]', box);
    var out = function (k) { return $('[data-out="' + k + '"]', box); };
    var send = $('[data-calc-send]', box), fallback = $('[data-calc-send-fallback]', box);

    function current() { return byId[mat ? mat.value : box.dataset.product] || pageData.products[0]; }
    function fillSizes() {
      var p = current(); if (!p) return;
      var prev = size.value;
      size.innerHTML = p.sizes.map(function (s, i) { return '<option value="' + i + '">' + s.label + ' мм — ' + num(s.area, 2) + ' м²</option>'; }).join('');
      if (prev && size.options[prev]) size.value = prev;
    }
    function calc() {
      var p = current(); if (!p || !p.sizes.length) return;
      var s = p.sizes[Number(size.value) || 0];
      var a = Math.max(0, Number(String(area.value).replace(',', '.')) || 0);
      var w = Number(waste.value) / 100;
      var plates = a > 0 ? Math.ceil((a * (1 + w)) / s.area) : 0;
      var real = plates * s.area;
      out('plates').textContent = plates ? plates + ' ' + plural(plates, ['плита', 'плиты', 'плит']) : '—';
      out('area').textContent = plates ? num(real, 2) + ' м²' : '—';
      var lines = ['Здравствуйте! Расчёт с сайта:', p.name + (p.article ? ' (' + p.article + ')' : ''),
        'Площадь по проекту: ' + num(a, 1) + ' м²', 'Формат: ' + s.label + ' мм',
        'Нужно: ' + plates + ' ' + plural(plates, ['плита', 'плиты', 'плит']) + ', ' + num(real, 2) + ' м² с запасом ' + waste.value + '%'];
      if (p.price) {
        var cost = real * p.price;
        out('cost').textContent = plates ? money(cost) : '—';
        if (out('bonus')) out('bonus').textContent = plates ? money(cost * pageData.bonus / 100) : '—';
        out('note').textContent = 'По цене ' + money(p.price) + ' за м². Количество округляется до целой плиты, итог подтвердит менеджер.';
        lines.push('Ориентировочно: ' + money(cost));
      } else {
        out('cost').textContent = 'По запросу';
        if (out('bonus')) out('bonus').textContent = '—';
        out('note').textContent = 'Цена на этот материал уточняется — отправьте расчёт менеджеру, он пришлёт стоимость.';
      }
      if (pageData.wa && send) {
        send.href = 'https://wa.me/' + pageData.wa + '?text=' + encodeURIComponent(lines.join('\n'));
        send.hidden = false; if (fallback) fallback.hidden = true;
      }
    }
    if (mat) mat.addEventListener('change', function () { fillSizes(); calc(); });
    [size, waste].forEach(function (el) { el.addEventListener('change', calc); });
    area.addEventListener('input', calc);
    fillSizes(); calc();
  });

  /* ---------------------------------------------------------- галерея */
  var main = $('#gallery-main');
  $$('.thumb').forEach(function (t) {
    t.addEventListener('click', function () {
      if (main) main.src = t.dataset.src;
      $$('.thumb').forEach(function (x) { x.classList.toggle('is-active', x === t); });
    });
  });

  /* ---------------------------------------------------------- наличие */
  var ss = $('#stock-search'), so = $('#stock-only');
  if (ss && so) {
    var rows = $$('.stock-table tbody tr');
    var run = function () {
      var q = ss.value.trim().toLowerCase();
      rows.forEach(function (r) {
        var ok = (!q || r.dataset.search.indexOf(q) >= 0) && (!so.checked || r.dataset.avail === 'in' || r.dataset.avail === 'low');
        r.hidden = !ok;
      });
    };
    ss.addEventListener('input', run); so.addEventListener('change', run); run();
  }
})();
