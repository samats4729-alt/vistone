/* VISTONE — админка. Всё, что показывает сайт, редактируется здесь. */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var S = null;             // данные: settings, series, products
  var route = 'products';
  var dirty = false;
  var nf = new Intl.NumberFormat('ru-RU');

  var NAV = [
    ['products', 'Коллекции'],
    ['prices', 'Цены и наличие'],
    ['series', 'Серии'],
    ['home', 'Главная страница'],
    ['sections', 'Разделы сайта'],
    ['contacts', 'Контакты'],
    ['settings', 'Настройки'],
  ];

  /* ------------------------------------------------------------ помощники */
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function toast(msg, err) {
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, err ? 5000 : 2600);
  }
  function numOrNull(v) {
    if (v === '' || v == null) return null;
    var n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : null;
  }
  function setDirty(v) {
    dirty = v;
    var st = $('[data-status]');
    if (st) {
      st.textContent = v ? 'Есть несохранённые изменения' : 'Все изменения сохранены';
      st.classList.toggle('dirty', v);
    }
  }
  function leaveOk() {
    return !dirty || confirm('Есть несохранённые изменения. Уйти без сохранения?');
  }
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  function api(method, url, body, isForm) {
    var opt = { method: method, credentials: 'same-origin', headers: { 'X-Requested-With': 'vistone-admin' } };
    if (body !== undefined) {
      if (isForm) opt.body = body;
      else { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    }
    return fetch(url, opt).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (res.status === 401 && url.indexOf('/login') < 0) { S = null; renderLogin(); throw new Error('Сессия закончилась — войдите снова'); }
        if (!res.ok) throw new Error((data && data.error) || 'Ошибка ' + res.status);
        return data;
      });
    });
  }
  function upload(files) {
    var fd = new FormData();
    Array.prototype.forEach.call(files, function (f) { fd.append('files', f); });
    toast('Загружаю фото…');
    return api('POST', '/api/admin/upload', fd, true).then(function (r) { return r.urls; });
  }
  function pickFiles(multiple) {
    return new Promise(function (resolve) {
      var i = document.createElement('input');
      i.type = 'file'; i.accept = 'image/jpeg,image/png,image/webp'; i.multiple = !!multiple;
      i.onchange = function () { resolve(i.files && i.files.length ? i.files : null); };
      i.click();
    });
  }

  function seriesName(id) { var s = S.series.find(function (x) { return x.id === id; }); return s ? s.name : 'Без серии'; }
  function stockTag(p) {
    var low = (S.settings.calc && S.settings.calc.lowStock) || 30;
    if (p.stock == null) return '<span class="tag">Наличие не указано</span>';
    if (p.stock <= 0) return '<span class="tag">Под заказ</span>';
    if (p.stock < low) return '<span class="tag tag-warn">Мало: ' + nf.format(p.stock) + ' м²</span>';
    return '<span class="tag tag-ok">В наличии: ' + nf.format(p.stock) + ' м²</span>';
  }
  function priceText(p) { return p.price ? nf.format(p.price) + ' ₸/м²' : 'Цена по запросу'; }
  function values(key) {
    var set = {};
    S.products.forEach(function (p) { if (p[key]) set[p[key]] = 1; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'ru'); });
  }
  function datalist(id, list) {
    return '<datalist id="' + id + '">' + list.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>';
  }

  /* поля формы; data-k — путь к значению в черновике, например hero.title */
  function fText(label, k, value, o) {
    o = o || {};
    return '<label class="field"><span>' + esc(label) + '</span>' +
      '<input type="' + (o.type || 'text') + '" data-k="' + k + '" value="' + esc(value == null ? '' : value) + '"' +
      (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + (o.list ? ' list="' + o.list + '"' : '') +
      (o.type === 'number' ? ' min="0" step="any" inputmode="decimal"' : '') + '>' +
      (o.hint ? '<small class="hint">' + esc(o.hint) + '</small>' : '') + '</label>';
  }
  function fArea(label, k, value, o) {
    o = o || {};
    return '<label class="field"><span>' + esc(label) + '</span>' +
      '<textarea data-k="' + k + '" rows="' + (o.rows || 3) + '"' + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + '>' + esc(value || '') + '</textarea>' +
      (o.hint ? '<small class="hint">' + esc(o.hint) + '</small>' : '') + '</label>';
  }
  function getPath(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
  function setPath(obj, path, v) {
    var parts = path.split('.'), last = parts.pop();
    var o = parts.reduce(function (acc, k) { if (acc[k] == null) acc[k] = {}; return acc[k]; }, obj);
    o[last] = v;
  }
  /** Связывает поля [data-k] внутри root с черновиком draft. */
  function bind(root, draft, numeric) {
    $$('[data-k]', root).forEach(function (el) {
      var ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, function () {
        var k = el.dataset.k, v;
        if (el.type === 'checkbox') v = el.checked;
        else if (el.type === 'number' || (numeric && numeric.indexOf(k) >= 0)) v = numOrNull(el.value);
        else v = el.value;
        setPath(draft, k, v);
        setDirty(true);
      });
    });
  }

  /**
   * Редактор списка. arr меняется на месте.
   * fields: [{key, label, area}] — для списка строк key = null.
   */
  function listEditor(host, arr, fields, addLabel) {
    function draw() {
      host.innerHTML = '<div class="list">' + arr.map(function (item, i) {
        return '<div class="list-row"><div class="cells">' + fields.map(function (f) {
          var v = f.key ? item[f.key] : item;
          return f.area
            ? '<textarea rows="2" data-i="' + i + '" data-f="' + (f.key || '') + '" placeholder="' + esc(f.label) + '" aria-label="' + esc(f.label) + '">' + esc(v || '') + '</textarea>'
            : '<input type="text" data-i="' + i + '" data-f="' + (f.key || '') + '" value="' + esc(v || '') + '" placeholder="' + esc(f.label) + '" aria-label="' + esc(f.label) + '">';
        }).join('') + '</div><div class="ctrls">' +
          '<button class="btn btn-icon" type="button" data-up="' + i + '" title="Выше"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="btn btn-icon" type="button" data-down="' + i + '" title="Ниже"' + (i === arr.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button class="btn btn-icon btn-danger" type="button" data-del="' + i + '" title="Удалить">✕</button>' +
          '</div></div>';
      }).join('') + '</div><button class="btn btn-sm list-add" type="button" data-add>+ ' + esc(addLabel || 'Добавить') + '</button>';
      $$('[data-i]', host).forEach(function (el) {
        el.addEventListener('input', function () {
          var i = Number(el.dataset.i), f = el.dataset.f;
          if (f) arr[i][f] = el.value; else arr[i] = el.value;
          setDirty(true);
        });
      });
      $$('[data-up]', host).forEach(function (b) { b.onclick = function () { var i = +b.dataset.up; arr.splice(i - 1, 0, arr.splice(i, 1)[0]); setDirty(true); draw(); }; });
      $$('[data-down]', host).forEach(function (b) { b.onclick = function () { var i = +b.dataset.down; arr.splice(i + 1, 0, arr.splice(i, 1)[0]); setDirty(true); draw(); }; });
      $$('[data-del]', host).forEach(function (b) { b.onclick = function () { arr.splice(+b.dataset.del, 1); setDirty(true); draw(); }; });
      $('[data-add]', host).onclick = function () {
        if (fields.length === 1 && !fields[0].key) arr.push('');
        else { var o = {}; fields.forEach(function (f) { o[f.key] = ''; }); arr.push(o); }
        setDirty(true); draw();
        var last = $$('.list-row', host).pop(); if (last) { var inp = $('input, textarea', last); if (inp) inp.focus(); }
      };
    }
    draw();
  }

  /** Список значений-«фишек»: размеры, толщины. */
  function chipEditor(host, arr, placeholder, normalize) {
    function draw() {
      host.innerHTML = '<div class="chiplist">' + arr.map(function (v, i) {
        return '<span class="chip">' + esc(v) + '<button type="button" data-del="' + i + '" aria-label="Удалить">×</button></span>';
      }).join('') + '<span class="chip-input"><input type="text" placeholder="' + esc(placeholder) + '"><button class="btn btn-sm" type="button">Добавить</button></span></div>';
      $$('[data-del]', host).forEach(function (b) { b.onclick = function () { arr.splice(+b.dataset.del, 1); setDirty(true); draw(); }; });
      var inp = $('.chip-input input', host);
      var add = function () {
        var v = normalize(inp.value);
        if (v === null) { toast('Не получилось распознать «' + inp.value + '»', true); return; }
        if (arr.indexOf(v) < 0) arr.push(v);
        setDirty(true); draw(); $('.chip-input input', host).focus();
      };
      $('.chip-input button', host).onclick = add;
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    }
    draw();
  }
  function normSize(v) {
    var m = String(v).match(/(\d{2,5})\s*[×xх*]\s*(\d{2,5})/i);
    return m ? m[1] + '×' + m[2] : null;
  }
  function normThickness(v) {
    var n = numOrNull(v);
    return n && n > 0 && n <= 100 ? n : null;
  }

  /* ------------------------------------------------------------ вход */
  function renderLogin() {
    setDirty(false);
    app.innerHTML = '<div class="login"><form class="login-box" id="login">' +
      '<h1>Админка VISTONE</h1><p>Введите пароль, чтобы управлять сайтом.</p>' +
      '<label class="field"><span>Пароль</span><input type="password" name="password" autocomplete="current-password" required autofocus></label>' +
      '<div style="margin-top:16px"><button class="btn btn-primary" type="submit" style="width:100%">Войти</button></div>' +
      '<p class="login-err" id="login-err"></p></form></div>';
    $('#login').addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = e.target.password.value;
      $('#login-err').textContent = '';
      api('POST', '/api/admin/login', { password: pw })
        .then(load)
        .catch(function (err) { $('#login-err').textContent = err.message; });
    });
  }

  function load() {
    return api('GET', '/api/admin/state').then(function (data) {
      S = data;
      renderShell();
    });
  }

  /* ------------------------------------------------------------ каркас */
  function renderShell() {
    app.innerHTML = '<div class="shell"><aside class="side">' +
      '<div class="side-logo">VISTONE<small>Админка сайта</small></div>' +
      NAV.map(function (n) { return '<a href="#' + n[0] + '" data-route="' + n[0] + '">' + n[1] + '</a>'; }).join('') +
      '<div class="side-bottom"><a href="/" target="_blank" rel="noopener">Открыть сайт ↗</a><button type="button" id="logout">Выйти</button></div>' +
      '</aside><main class="main" id="main"></main></div>';
    $$('[data-route]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (!leaveOk()) return;
        go(a.dataset.route);
      });
    });
    $('#logout').onclick = function () {
      if (!leaveOk()) return;
      api('POST', '/api/admin/logout').finally(renderLogin);
    };
    var h = location.hash.replace('#', '').split('/');
    go(NAV.some(function (n) { return n[0] === h[0]; }) ? h[0] : 'products', h[1]);
  }

  function go(r, arg) {
    route = r;
    setDirty(false);
    $$('[data-route]').forEach(function (a) { a.classList.toggle('is-active', a.dataset.route === r); });
    history.replaceState(null, '', '#' + r + (arg ? '/' + arg : ''));
    var main = $('#main');
    window.scrollTo(0, 0);
    ({ products: arg ? function (m) { pageEditor(m, arg); } : pageProducts, prices: pagePrices, series: pageSeries, home: pageHome, sections: pageSections, contacts: pageContacts, settings: pageSettings })[r](main);
  }

  function saveBar(label) {
    return '<div class="editor-bar"><span class="status" data-status>Все изменения сохранены</span>' +
      '<button class="btn btn-primary" type="button" data-save>' + esc(label || 'Сохранить') + '</button></div>';
  }

  /* ------------------------------------------------------------ коллекции */
  var listState = { q: '', series: '', hidden: 'all' };

  function pageProducts(main) {
    main.innerHTML = '<div class="page-title"><h1>Коллекции</h1><button class="btn btn-primary" type="button" id="add">+ Добавить коллекцию</button></div>' +
      '<p class="page-lead">Нажмите на коллекцию, чтобы изменить название, фото, характеристики, цену и наличие. Скрытые коллекции не видны на сайте.</p>' +
      '<div class="toolbar"><input type="search" id="q" placeholder="Поиск по названию или артикулу" value="' + esc(listState.q) + '">' +
      '<select id="fs"><option value="">Все серии</option>' + S.series.map(function (s) { return '<option value="' + esc(s.id) + '"' + (listState.series === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '<option value="__none"' + (listState.series === '__none' ? ' selected' : '') + '>Без серии</option></select>' +
      '<select id="fh"><option value="all">Все</option><option value="shown"' + (listState.hidden === 'shown' ? ' selected' : '') + '>Только на сайте</option><option value="hidden"' + (listState.hidden === 'hidden' ? ' selected' : '') + '>Только скрытые</option></select>' +
      '<span class="hint" id="cnt"></span></div><div class="plist" id="plist"></div>';
    var draw = function () {
      var q = listState.q.toLowerCase();
      var list = S.products.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).filter(function (p) {
        if (q && (p.name + ' ' + (p.article || '')).toLowerCase().indexOf(q) < 0) return false;
        if (listState.series === '__none' && S.series.some(function (s) { return s.id === p.seriesId; })) return false;
        if (listState.series && listState.series !== '__none' && p.seriesId !== listState.series) return false;
        if (listState.hidden === 'shown' && p.hidden) return false;
        if (listState.hidden === 'hidden' && !p.hidden) return false;
        return true;
      });
      $('#cnt').textContent = 'Показано ' + list.length + ' из ' + S.products.length;
      $('#plist').innerHTML = list.length ? list.map(function (p) {
        var img = p.images && p.images[0];
        return '<button class="pitem" type="button" data-id="' + esc(p.id) + '">' +
          (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<span class="ph"></span>') +
          '<span><span class="pitem-name">' + esc(p.name) + '</span><br><span class="pitem-meta">' + esc(seriesName(p.seriesId)) + (p.article ? ' · ' + esc(p.article) : '') + '</span></span>' +
          '<span class="pitem-right"><span class="pitem-price">' + esc(priceText(p)) + '</span>' + stockTag(p) +
          (p.featured ? '<span class="tag tag-star">На главной</span>' : '') + (p.hidden ? '<span class="tag tag-hidden">Скрыта</span>' : '') + '</span></button>';
      }).join('') : '<p style="padding:20px" class="hint">Ничего не найдено.</p>';
      $$('.pitem').forEach(function (b) { b.onclick = function () { go('products', b.dataset.id); }; });
    };
    $('#q').addEventListener('input', function (e) { listState.q = e.target.value; draw(); });
    $('#fs').addEventListener('change', function (e) { listState.series = e.target.value; draw(); });
    $('#fh').addEventListener('change', function (e) { listState.hidden = e.target.value; draw(); });
    $('#add').onclick = function () { go('products', 'new'); };
    draw();
  }

  function blankProduct() {
    return {
      name: '', article: '', seriesId: (S.series[0] || {}).id || '', type: '', color: '', finish: '', body: '',
      sizes: ['1200×3600', '1000×3000'], thickness: [3, 6], composition: '', country: '', factory: '', specs: [],
      description: '', usage: '', price: null, stock: null, readyIn: '', leadTime: '', arrival: '',
      images: [], featured: false, hidden: false, order: 0,
    };
  }

  function pageEditor(main, id) {
    var isNew = id === 'new';
    var src = isNew ? blankProduct() : S.products.find(function (p) { return p.id === id; });
    if (!src) { go('products'); return; }
    var d = clone(src);
    var def = S.settings.defaults || {};
    main.innerHTML = '<button class="back" type="button" id="back">← Все коллекции</button>' +
      '<div class="page-title"><h1>' + (isNew ? 'Новая коллекция' : esc(d.name)) + '</h1>' +
      (!isNew && !d.hidden ? '<a class="btn btn-sm" href="/catalog/' + esc(d.slug) + '" target="_blank" rel="noopener">Открыть на сайте ↗</a>' : '') + '</div>' +
      '<p class="page-lead">Поля со звёздочкой обязательны. Пустые поля на сайте показываются как «Уточняйте у менеджера».</p>' +

      '<section class="panel"><h2>Основное</h2><p class="hint">Название, серия и то, по чему дизайнер ищет материал в фильтрах.</p>' +
      '<div class="row">' + fText('Название *', 'name', d.name) + fText('Артикул', 'article', d.article) +
      '<label class="field"><span>Серия</span><select data-k="seriesId"><option value="">Без серии</option>' +
      S.series.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === d.seriesId ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="row">' + fText('Тип материала', 'type', d.type, { list: 'dl-type', hint: 'Мрамор, камень, дерево…' }) +
      fText('Цвет', 'color', d.color, { list: 'dl-color' }) +
      fText('Фактура', 'finish', d.finish, { list: 'dl-finish', hint: 'Отделка поверхности' }) +
      fText('Основа плиты', 'body', d.body, { list: 'dl-body' }) + '</div>' +
      datalist('dl-type', values('type')) + datalist('dl-color', values('color')) + datalist('dl-finish', values('finish')) + datalist('dl-body', values('body')) +
      '</section>' +

      '<section class="panel"><h2>Фото</h2><p class="hint">Первое фото — главное, оно на карточке в каталоге. Можно перетащить файлы на серую рамку. JPG, PNG или WebP до 15 МБ.</p><div class="photos" id="photos"></div></section>' +

      '<section class="panel"><h2>Размеры и толщина</h2>' +
      '<div class="field"><span>Размеры, мм</span><div id="sizes"></div><small class="hint">Например, 1200×3600 — площадь плиты посчитается сама.</small></div>' +
      '<div class="field"><span>Толщина, мм</span><div id="thick"></div></div></section>' +

      '<section class="panel"><h2>Цена и наличие</h2><p class="hint">Пустая цена — на сайте «Цена по запросу». Остаток 0 — «Под заказ». Пустой остаток — «Наличие уточняйте».</p>' +
      '<div class="row">' + fText('Цена за м², ₸', 'price', d.price, { type: 'number', placeholder: 'по запросу' }) +
      fText('Остаток на складе, м²', 'stock', d.stock, { type: 'number', placeholder: 'не указан' }) + '</div>' +
      '<div class="row">' + fText('Когда можно получить', 'readyIn', d.readyIn, { placeholder: 'Например: самовывоз сегодня, доставка 1–3 дня' }) +
      fText('Срок поставки под заказ', 'leadTime', d.leadTime, { placeholder: 'Например: 5–6 недель' }) +
      fText('Ожидается поступление', 'arrival', d.arrival, { placeholder: 'Например: 15 ноября, 200 м²' }) + '</div></section>' +

      '<section class="panel"><h2>Характеристики</h2><p class="hint">Если поле пустое, подставится значение из «Настройки → Общие характеристики».</p>' +
      '<div class="row">' + fText('Страна', 'country', d.country, { placeholder: def.country ? 'по умолчанию: ' + def.country : '' }) +
      fText('Производство', 'factory', d.factory, { placeholder: def.factory ? 'по умолчанию: ' + def.factory : '' }) + '</div>' +
      fArea('Состав — из чего произведён материал', 'composition', d.composition, { placeholder: def.composition ? 'по умолчанию: ' + def.composition : '' }) +
      '<div class="field"><span>Технические характеристики</span><div id="specs"></div></div>' +
      fArea('Применение', 'usage', d.usage, { rows: 2, placeholder: 'Стены, столешницы, фасады…' }) +
      fArea('Описание', 'description', d.description, { rows: 4 }) + '</section>' +

      '<section class="panel"><h2>Показ на сайте</h2>' +
      '<div class="row"><label class="check"><input type="checkbox" data-k="featured"' + (d.featured ? ' checked' : '') + '> Показывать на главной в «Популярных материалах»</label>' +
      '<label class="check"><input type="checkbox" data-k="hidden"' + (d.hidden ? ' checked' : '') + '> Скрыть с сайта (например, товара сейчас нет)</label></div>' +
      '<div class="row">' + fText('Порядок в каталоге', 'order', d.order, { type: 'number', hint: 'Меньше число — выше в каталоге' }) +
      fText('Адрес страницы', 'slug', d.slug || '', { placeholder: 'заполнится сам по названию', hint: 'Латиница и дефисы: vistone.kz/catalog/…' }) + '</div></section>' +

      '<div class="editor-bar"><span class="status" data-status>Все изменения сохранены</span>' +
      (!isNew ? '<button class="btn btn-danger" type="button" id="del">Удалить</button><button class="btn" type="button" id="dup">Дублировать</button>' : '') +
      '<button class="btn btn-primary" type="button" data-save>' + (isNew ? 'Создать коллекцию' : 'Сохранить') + '</button></div>';

    bind(main, d, ['price', 'stock', 'order']);

    // фото
    var photos = $('#photos');
    function drawPhotos() {
      photos.innerHTML = d.images.map(function (src, i) {
        return '<div class="photo"><div class="photo-img"><img src="' + esc(src) + '" alt="">' + (i === 0 ? '<span class="photo-main">Главное</span>' : '') + '</div>' +
          '<div class="photo-actions">' +
          '<button class="btn btn-sm" type="button" data-left="' + i + '" title="Левее"' + (i === 0 ? ' disabled' : '') + '>←</button>' +
          '<button class="btn btn-sm" type="button" data-right="' + i + '" title="Правее"' + (i === d.images.length - 1 ? ' disabled' : '') + '>→</button>' +
          '<button class="btn btn-sm btn-danger" type="button" data-rm="' + i + '" title="Убрать">✕</button></div></div>';
      }).join('') + '<div class="dropzone" id="drop" tabindex="0" role="button">+ Загрузить фото</div>';
      $$('[data-left]', photos).forEach(function (b) { b.onclick = function () { var i = +b.dataset.left; d.images.splice(i - 1, 0, d.images.splice(i, 1)[0]); setDirty(true); drawPhotos(); }; });
      $$('[data-right]', photos).forEach(function (b) { b.onclick = function () { var i = +b.dataset.right; d.images.splice(i + 1, 0, d.images.splice(i, 1)[0]); setDirty(true); drawPhotos(); }; });
      $$('[data-rm]', photos).forEach(function (b) { b.onclick = function () { d.images.splice(+b.dataset.rm, 1); setDirty(true); drawPhotos(); }; });
      var drop = $('#drop');
      var addFiles = function (files) {
        if (!files) return;
        upload(files).then(function (urls) { d.images = d.images.concat(urls); setDirty(true); drawPhotos(); toast('Фото добавлено. Не забудьте сохранить.'); })
          .catch(function (e) { toast(e.message, true); });
      };
      drop.onclick = function () { pickFiles(true).then(addFiles); };
      drop.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop.click(); } };
      drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = function () { drop.classList.remove('over'); };
      drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); };
    }
    drawPhotos();

    chipEditor($('#sizes'), d.sizes, '1200×3600', normSize);
    chipEditor($('#thick'), d.thickness, '6', normThickness);
    listEditor($('#specs'), d.specs, [{ key: 'name', label: 'Характеристика, например «Водопоглощение»' }, { key: 'value', label: 'Значение, например «≤ 0,05 %»' }], 'Добавить характеристику');

    $('#back').onclick = function () { if (leaveOk()) go('products'); };
    $('[data-save]').onclick = function () {
      if (!String(d.name || '').trim()) { toast('Укажите название коллекции', true); return; }
      var req = isNew ? api('POST', '/api/admin/products', d) : api('PUT', '/api/admin/products/' + encodeURIComponent(id), d);
      req.then(function (r) {
        var i = S.products.findIndex(function (p) { return p.id === r.product.id; });
        if (i >= 0) S.products[i] = r.product; else S.products.push(r.product);
        setDirty(false);
        toast(isNew ? 'Коллекция создана' : 'Сохранено');
        if (isNew) go('products', r.product.id);
      }).catch(function (e) { toast(e.message, true); });
    };
    if (!isNew) {
      $('#del').onclick = function () {
        if (!confirm('Удалить «' + src.name + '» навсегда? Если товара просто нет в наличии — лучше скрыть его.')) return;
        api('DELETE', '/api/admin/products/' + encodeURIComponent(id)).then(function () {
          S.products = S.products.filter(function (p) { return p.id !== id; });
          setDirty(false); toast('Коллекция удалена'); go('products');
        }).catch(function (e) { toast(e.message, true); });
      };
      $('#dup').onclick = function () {
        if (!leaveOk()) return;
        api('POST', '/api/admin/products/' + encodeURIComponent(id) + '/duplicate').then(function (r) {
          S.products.push(r.product); setDirty(false);
          toast('Копия создана и скрыта с сайта — поправьте и снимите галочку «Скрыть»');
          go('products', r.product.id);
        }).catch(function (e) { toast(e.message, true); });
      };
    }
  }

  /* ------------------------------------------------------------ цены и наличие */
  function pagePrices(main) {
    var changes = {};
    var st = { q: '', series: '' };
    main.innerHTML = '<div class="page-title"><h1>Цены и наличие</h1></div>' +
      '<p class="page-lead">Быстро обновить цены и склад по всем коллекциям сразу. Изменённые ячейки подсвечиваются — сохраните их одной кнопкой внизу.</p>' +
      '<div class="toolbar"><input type="search" id="q" placeholder="Поиск по названию или артикулу">' +
      '<select id="fs"><option value="">Все серии</option>' + S.series.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="table-wrap"><table class="grid"><thead><tr><th>Коллекция</th><th>Цена за м², ₸</th><th>Остаток, м²</th><th>Когда можно получить</th><th>Срок поставки</th><th>Ожидается</th><th>Скрыть</th></tr></thead><tbody id="rows"></tbody></table></div>' +
      '<div class="editor-bar"><span class="status" data-status>Все изменения сохранены</span><button class="btn btn-primary" type="button" data-save disabled>Сохранить изменения</button></div>';
    var cols = [['price', 'num'], ['stock', 'num'], ['readyIn', ''], ['leadTime', ''], ['arrival', '']];
    function val(p, k) { return changes[p.id] && k in changes[p.id] ? changes[p.id][k] : p[k]; }
    function count() { return Object.keys(changes).length; }
    function refreshBar() {
      var n = count(), b = $('[data-save]');
      b.disabled = !n;
      b.textContent = n ? 'Сохранить изменения (' + n + ')' : 'Сохранить изменения';
      setDirty(!!n);
    }
    function draw() {
      var q = st.q.toLowerCase();
      var list = S.products.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).filter(function (p) {
        return (!q || (p.name + ' ' + (p.article || '')).toLowerCase().indexOf(q) >= 0) && (!st.series || p.seriesId === st.series);
      });
      $('#rows').innerHTML = list.map(function (p) {
        return '<tr data-id="' + esc(p.id) + '"><td><div class="nm">' + esc(p.name) + '</div><div class="sub">' + esc(seriesName(p.seriesId)) + (p.article ? ' · ' + esc(p.article) : '') + '</div></td>' +
          cols.map(function (c) {
            var v = val(p, c[0]);
            var ch = changes[p.id] && c[0] in changes[p.id];
            return '<td class="' + c[1] + (ch ? ' changed' : '') + '"><input ' + (c[1] ? 'type="number" min="0" step="any" inputmode="decimal"' : 'type="text"') + ' data-c="' + c[0] + '" value="' + esc(v == null ? '' : v) + '"' +
              (c[0] === 'price' ? ' placeholder="по запросу"' : c[0] === 'stock' ? ' placeholder="не указан"' : '') + '></td>';
          }).join('') +
          '<td class="' + (changes[p.id] && 'hidden' in changes[p.id] ? 'changed' : '') + '"><input type="checkbox" data-c="hidden"' + (val(p, 'hidden') ? ' checked' : '') + ' aria-label="Скрыть с сайта"></td></tr>';
      }).join('');
      $$('#rows [data-c]').forEach(function (el) {
        el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', function () {
          var tr = el.closest('tr'), id = tr.dataset.id, k = el.dataset.c;
          var p = S.products.find(function (x) { return x.id === id; });
          var v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? numOrNull(el.value) : el.value.trim();
          var orig = p[k] == null ? (el.type === 'checkbox' ? false : el.type === 'number' ? null : '') : p[k];
          changes[id] = changes[id] || {};
          if (v === orig) delete changes[id][k]; else changes[id][k] = v;
          if (!Object.keys(changes[id]).length) delete changes[id];
          el.closest('td').classList.toggle('changed', !!(changes[id] && k in changes[id]));
          refreshBar();
        });
      });
    }
    $('#q').addEventListener('input', function (e) { st.q = e.target.value; draw(); });
    $('#fs').addEventListener('change', function (e) { st.series = e.target.value; draw(); });
    $('[data-save]').onclick = function () {
      var rows = Object.keys(changes).map(function (id) { var r = clone(changes[id]); r.id = id; return r; });
      api('PATCH', '/api/admin/products', { rows: rows }).then(function (r) {
        rows.forEach(function (row) {
          var p = S.products.find(function (x) { return x.id === row.id; });
          Object.keys(row).forEach(function (k) { if (k !== 'id') p[k] = row[k]; });
        });
        changes = {}; refreshBar(); draw();
        toast('Обновлено коллекций: ' + r.updated);
      }).catch(function (e) { toast(e.message, true); });
    };
    draw(); refreshBar();
  }

  /* ------------------------------------------------------------ серии */
  function pageSeries(main) {
    var list = clone(S.series);
    main.innerHTML = '<div class="page-title"><h1>Серии</h1></div>' +
      '<p class="page-lead">Серии — это разделы каталога: на главной они показаны плитками, в каталоге по ним можно отфильтровать. Обложка необязательна — без неё берётся фото коллекции из серии.</p>' +
      '<section class="panel"><div id="list"></div><button class="btn btn-sm list-add" type="button" id="add">+ Добавить серию</button></section>' + saveBar();
    function count(id) { return S.products.filter(function (p) { return p.seriesId === id; }).length; }
    function draw() {
      $('#list').innerHTML = list.map(function (s, i) {
        return '<div class="series-item" data-i="' + i + '">' +
          '<div><div class="series-cover" style="' + (s.image ? 'background-image:url(\'' + esc(s.image) + '\')' : '') + '">' + (s.image ? '' : 'Без обложки') + '</div>' +
          '<div class="photo-actions"><button class="btn btn-sm" type="button" data-img="' + i + '">Фото</button>' + (s.image ? '<button class="btn btn-sm btn-danger" type="button" data-noimg="' + i + '">✕</button>' : '') + '</div></div>' +
          '<div><div class="row">' + fText('Название', 's' + i + '.name', s.name) + fText('На английском', 's' + i + '.nameEn', s.nameEn) + '</div>' +
          fArea('Описание', 's' + i + '.description', s.description, { rows: 2 }) +
          '<small class="hint">Коллекций в серии: ' + count(s.id) + '</small></div>' +
          '<div class="ctrls" style="display:flex;gap:4px"><button class="btn btn-icon" type="button" data-up="' + i + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="btn btn-icon" type="button" data-down="' + i + '"' + (i === list.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button class="btn btn-icon btn-danger" type="button" data-del="' + i + '">✕</button></div></div>';
      }).join('');
      $$('[data-k]', $('#list')).forEach(function (el) {
        el.addEventListener('input', function () {
          var m = el.dataset.k.match(/^s(\d+)\.(\w+)$/); list[+m[1]][m[2]] = el.value; setDirty(true);
        });
      });
      $$('[data-up]').forEach(function (b) { b.onclick = function () { var i = +b.dataset.up; list.splice(i - 1, 0, list.splice(i, 1)[0]); setDirty(true); draw(); }; });
      $$('[data-down]').forEach(function (b) { b.onclick = function () { var i = +b.dataset.down; list.splice(i + 1, 0, list.splice(i, 1)[0]); setDirty(true); draw(); }; });
      $$('[data-del]').forEach(function (b) {
        b.onclick = function () {
          var s = list[+b.dataset.del], n = s.id ? count(s.id) : 0;
          if (n && !confirm('В серии «' + s.name + '» ' + n + ' коллекций. Они останутся на сайте, но без серии. Удалить серию?')) return;
          list.splice(+b.dataset.del, 1); setDirty(true); draw();
        };
      });
      $$('[data-img]').forEach(function (b) {
        b.onclick = function () {
          pickFiles(false).then(function (f) {
            if (!f) return;
            upload(f).then(function (u) { list[+b.dataset.img].image = u[0]; setDirty(true); draw(); }).catch(function (e) { toast(e.message, true); });
          });
        };
      });
      $$('[data-noimg]').forEach(function (b) { b.onclick = function () { list[+b.dataset.noimg].image = ''; setDirty(true); draw(); }; });
    }
    $('#add').onclick = function () { list.push({ id: '', name: 'Новая серия', nameEn: '', description: '', image: '' }); setDirty(true); draw(); };
    $('[data-save]').onclick = function () {
      api('PUT', '/api/admin/series', { series: list }).then(function (r) {
        S.series = r.series; list = clone(r.series);
        return api('GET', '/api/admin/state');
      }).then(function (data) { S = data; setDirty(false); draw(); toast('Серии сохранены'); })
        .catch(function (e) { toast(e.message, true); });
    };
    draw();
  }

  /* ------------------------------------------------------------ тексты и настройки */
  function saveSettings(draft) {
    return api('PUT', '/api/admin/settings', draft).then(function (r) {
      S.settings = r.settings; setDirty(false); toast('Сохранено — изменения уже на сайте');
    }).catch(function (e) { toast(e.message, true); });
  }

  function pageHome(main) {
    var d = clone(S.settings);
    d.about = d.about || { points: [] }; d.hero = d.hero || {}; d.applications = d.applications || [];
    main.innerHTML = '<div class="page-title"><h1>Главная страница</h1><a class="btn btn-sm" href="/" target="_blank" rel="noopener">Открыть ↗</a></div>' +
      '<p class="page-lead">Первый экран, блок «Что такое VISTONE» и список, где применяются плиты.</p>' +
      '<section class="panel"><h2>Первый экран</h2>' +
      '<div class="hero-preview" id="heroimg"></div><div class="toolbar"><button class="btn btn-sm" type="button" id="heroup">Заменить фото</button><span class="hint">Горизонтальное фото интерьера, от 1600 px по ширине.</span></div>' +
      fText('Заголовок', 'hero.title', d.hero.title) + fArea('Подзаголовок', 'hero.subtitle', d.hero.subtitle, { rows: 2 }) +
      '<div class="row">' + fText('Короткая подпись над заголовком', 'tagline', d.tagline) + fText('Город', 'city', d.city) + '</div></section>' +
      '<section class="panel"><h2>Что такое VISTONE</h2>' + fText('Заголовок блока', 'about.title', d.about.title) + fArea('Текст', 'about.text', d.about.text, { rows: 3 }) +
      '<div class="field"><span>Преимущества</span><small class="hint">По ТЗ: крупный формат, ультратонкие материалы, фактуры и коллекции, для дизайнеров и архитекторов.</small><div id="points"></div></div></section>' +
      '<section class="panel"><h2>Где применяется</h2><div id="apps"></div></section>' + saveBar();
    var drawHero = function () { $('#heroimg').style.backgroundImage = d.hero.image ? "url('" + d.hero.image + "')" : ''; };
    drawHero();
    $('#heroup').onclick = function () {
      pickFiles(false).then(function (f) {
        if (!f) return;
        upload(f).then(function (u) { d.hero.image = u[0]; setDirty(true); drawHero(); }).catch(function (e) { toast(e.message, true); });
      });
    };
    bind(main, d);
    listEditor($('#points'), d.about.points, [{ key: 'title', label: 'Заголовок' }, { key: 'text', label: 'Текст', area: true }], 'Добавить преимущество');
    listEditor($('#apps'), d.applications, [{ key: null, label: 'Например, «Столешницы»' }], 'Добавить');
    $('[data-save]').onclick = function () { saveSettings(d); };
  }

  function pageSections(main) {
    var d = clone(S.settings);
    ['designers', 'process', 'developers'].forEach(function (k) { d[k] = d[k] || {}; });
    d.designers.points = d.designers.points || []; d.process.steps = d.process.steps || [];
    d.developers.audiences = d.developers.audiences || []; d.developers.points = d.developers.points || [];
    main.innerHTML = '<div class="page-title"><h1>Разделы сайта</h1></div>' +
      '<p class="page-lead">Тексты разделов «Дизайнерам и архитекторам», «Как проходит работа» и «ЖК и застройщикам».</p>' +
      '<section class="panel"><h2>Дизайнерам и архитекторам</h2><div class="toolbar"><a class="btn btn-sm" href="/designers" target="_blank" rel="noopener">Открыть ↗</a></div>' +
      fText('Заголовок', 'designers.title', d.designers.title) + fArea('Вступление', 'designers.text', d.designers.text, { rows: 2 }) +
      '<div class="field"><span>Преимущества работы с вами</span><small class="hint">У пункта со словом «бонус» процент берётся из «Настроек» автоматически.</small><div id="dp"></div></div></section>' +
      '<section class="panel"><h2>Как проходит работа</h2>' + fText('Заголовок', 'process.title', d.process.title) +
      '<div class="field"><span>Шаги по порядку</span><div id="steps"></div></div></section>' +
      '<section class="panel"><h2>ЖК и застройщикам</h2><div class="toolbar"><a class="btn btn-sm" href="/developers" target="_blank" rel="noopener">Открыть ↗</a></div>' +
      fText('Заголовок', 'developers.title', d.developers.title) + fArea('Коммерческое предложение — текст', 'developers.text', d.developers.text, { rows: 3 }) +
      '<div class="field"><span>Для кого</span><div id="aud"></div></div><div class="field"><span>Условия</span><div id="devp"></div></div></section>' + saveBar();
    bind(main, d);
    listEditor($('#dp'), d.designers.points, [{ key: 'title', label: 'Заголовок' }, { key: 'text', label: 'Пояснение', area: true }], 'Добавить пункт');
    listEditor($('#steps'), d.process.steps, [{ key: 'title', label: 'Шаг' }, { key: 'text', label: 'Пояснение', area: true }], 'Добавить шаг');
    listEditor($('#aud'), d.developers.audiences, [{ key: null, label: 'Например, «Застройщики»' }], 'Добавить');
    listEditor($('#devp'), d.developers.points, [{ key: null, label: 'Условие' }], 'Добавить условие');
    $('[data-save]').onclick = function () { saveSettings(d); };
  }

  function pageContacts(main) {
    var d = clone(S.settings);
    d.contacts = d.contacts || {}; d.contacts.managers = d.contacts.managers || [];
    main.innerHTML = '<div class="page-title"><h1>Контакты</h1><a class="btn btn-sm" href="/contacts" target="_blank" rel="noopener">Открыть ↗</a></div>' +
      '<p class="page-lead">Эти контакты показываются в окне «Получить консультацию», на странице «Контакты» и в подвале сайта.</p>' +
      '<section class="panel"><h2>Менеджеры</h2><p class="hint">WhatsApp — только цифры с кодом страны, например 77011234567. Сообщения с кнопок «Написать по этому материалу» и из калькулятора уходят первому менеджеру, у которого указан WhatsApp.</p><div id="mgr"></div></section>' +
      '<section class="panel"><h2>Шоурум и соцсети</h2><div class="row">' +
      fText('Адрес шоурума', 'contacts.showroom', d.contacts.showroom) + fText('Часы работы', 'contacts.hours', d.contacts.hours, { placeholder: 'Пн–Сб, 10:00–19:00' }) + '</div><div class="row">' +
      fText('Instagram', 'contacts.instagram', d.contacts.instagram, { placeholder: 'vistone.kz' }) +
      fText('Ссылка на карту', 'contacts.mapUrl', d.contacts.mapUrl, { placeholder: 'https://2gis.kz/…', hint: 'Из 2ГИС или Яндекс Карт' }) + '</div></section>' + saveBar();
    bind(main, d);
    listEditor($('#mgr'), d.contacts.managers, [{ key: 'name', label: 'Имя' }, { key: 'role', label: 'Должность' }, { key: 'phone', label: 'Телефон, как показать' }, { key: 'whatsapp', label: 'WhatsApp, только цифры' }], 'Добавить менеджера');
    $('[data-save]').onclick = function () { saveSettings(d); };
  }

  function pageSettings(main) {
    var d = clone(S.settings);
    d.calc = d.calc || {}; d.defaults = d.defaults || {}; d.defaults.specs = d.defaults.specs || []; d.seo = d.seo || {};
    main.innerHTML = '<div class="page-title"><h1>Настройки</h1></div>' +
      '<section class="panel"><h2>Калькулятор и наличие</h2><div class="row">' +
      fText('Бонус дизайнера, %', 'calc.designerBonus', d.calc.designerBonus, { type: 'number', hint: 'Показывается в калькуляторе и разделе «Дизайнерам»' }) +
      fText('Запас на подрезку по умолчанию, %', 'calc.defaultWaste', d.calc.defaultWaste, { type: 'number' }) +
      fText('Порог «Осталось мало», м²', 'calc.lowStock', d.calc.lowStock, { type: 'number', hint: 'Если остаток меньше — жёлтая метка «Осталось N м²»' }) + '</div></section>' +
      '<section class="panel"><h2>Общие характеристики для всех коллекций</h2><p class="hint">Заполните один раз — подставится во все коллекции, где своё значение не указано.</p><div class="row">' +
      fText('Страна производства', 'defaults.country', d.defaults.country) + fText('Производство', 'defaults.factory', d.defaults.factory) + '</div>' +
      fArea('Состав — из чего произведён материал', 'defaults.composition', d.defaults.composition, { rows: 2 }) +
      '<div class="field"><span>Технические характеристики</span><small class="hint">Например, водопоглощение, морозостойкость, вес 1 м².</small><div id="dspecs"></div></div></section>' +
      '<section class="panel"><h2>Поиск в Google и Яндексе</h2>' + fText('Название сайта', 'siteName', d.siteName) +
      fText('Заголовок главной в поиске', 'seo.title', d.seo.title) + fArea('Описание в поиске', 'seo.description', d.seo.description, { rows: 2 }) + '</section>' +
      saveBar() +
      '<section class="panel" style="margin-top:28px"><h2>Пароль админки</h2><div class="row">' +
      '<label class="field"><span>Текущий пароль</span><input type="password" id="pw0" autocomplete="current-password"></label>' +
      '<label class="field"><span>Новый пароль</span><input type="password" id="pw1" autocomplete="new-password"><small class="hint">Не короче 8 символов</small></label>' +
      '<label class="field"><span>Новый пароль ещё раз</span><input type="password" id="pw2" autocomplete="new-password"></label></div>' +
      '<div class="toolbar" style="margin-top:14px"><button class="btn" type="button" id="pwsave">Сменить пароль</button></div></section>' +
      '<section class="panel"><h2>Резервная копия</h2><p class="hint">Файл со всеми коллекциями, текстами и настройками. Скачивайте раз в неделю и перед большими изменениями.</p>' +
      '<a class="btn" href="/api/admin/backup">Скачать резервную копию</a></section>';
    bind(main, d);
    listEditor($('#dspecs'), d.defaults.specs, [{ key: 'name', label: 'Характеристика' }, { key: 'value', label: 'Значение' }], 'Добавить характеристику');
    $('[data-save]').onclick = function () { saveSettings(d); };
    $('#pwsave').onclick = function () {
      var a = $('#pw0').value, b = $('#pw1').value, c = $('#pw2').value;
      if (b !== c) { toast('Новые пароли не совпадают', true); return; }
      api('POST', '/api/admin/password', { current: a, next: b }).then(function () {
        $('#pw0').value = $('#pw1').value = $('#pw2').value = '';
        toast('Пароль изменён');
      }).catch(function (e) { toast(e.message, true); });
    };
  }

  /* ------------------------------------------------------------ старт */
  api('GET', '/api/admin/session').then(function (r) { return r.authed ? load() : renderLogin(); }).catch(function () { renderLogin(); });
})();
