'use strict';

const { esc, money, num, plural, sizeArea } = require('../util');
const { effective, availability, seriesOf, facets, COLOR_SWATCH, sizesText, thicknessText } = require('../catalog');
const { page, managerCard, waHref, primaryManager } = require('./layout');

/* ------------------------------------------------------------ общие части */

function largestSize(p) {
  const s = [...(p.sizes || [])].sort((a, b) => (sizeArea(b) || 0) - (sizeArea(a) || 0))[0];
  return s ? `${s.replace('×', ' × ')} мм` : '';
}

function priceText(p) {
  return typeof p.price === 'number' && p.price > 0 ? `${money(p.price)} за м²` : 'Цена по запросу';
}

function card(p, ctx) {
  const s = seriesOf(p, ctx.series);
  const a = availability(p, ctx.settings);
  const meta = [p.finish, largestSize(p), thicknessText(p)].filter(Boolean).join(' · ');
  const img = (p.images && p.images[0]) || '';
  return `<a class="card" href="/catalog/${esc(p.slug)}"
    data-series="${esc(p.seriesId)}" data-type="${esc(p.type)}" data-color="${esc(p.color)}" data-finish="${esc(p.finish)}"
    data-sizes="${esc((p.sizes || []).join('|'))}" data-thickness="${esc((p.thickness || []).join('|'))}"
    data-price="${typeof p.price === 'number' ? p.price : ''}" data-stock="${typeof p.stock === 'number' ? p.stock : ''}"
    data-avail="${a.key}" data-order="${p.order || 0}"
    data-search="${esc([p.name, p.article, p.type, p.color, p.finish, s && s.name, s && s.nameEn].filter(Boolean).join(' ').toLowerCase())}">
    <div class="card-img">${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">` : ''}</div>
    <div class="card-body">
      ${s ? `<p class="card-series">${esc(s.name)}</p>` : ''}
      <h3 class="card-title">${esc(p.name)}</h3>
      ${meta ? `<p class="card-meta">${esc(meta)}</p>` : ''}
      <p class="card-price">${esc(priceText(p))}</p>
      <p class="badge badge-${a.key}">${esc(a.short)}</p>
    </div>
  </a>`;
}

function contactButton(label = 'Получить консультацию', cls = 'btn btn-primary') {
  return `<button class="${cls}" type="button" data-contact>${esc(label)}</button>`;
}

/** Кнопка «Написать» с готовым текстом; без WhatsApp открывает окно контактов. */
function waButton(settings, text, label, cls = 'btn btn-primary') {
  const href = waHref(primaryManager(settings), text);
  if (!href) return contactButton(label, cls);
  return `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}

function sectionHead(title, lead, more) {
  return `<div class="section-head">
    <div>
      <h2>${esc(title)}</h2>
      ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
    </div>
    ${more || ''}
  </div>`;
}

function steps(process) {
  const list = (process && process.steps) || [];
  return `<ol class="steps">
    ${list.map((s, i) => `<li class="step">
      <span class="step-n">${i + 1}</span>
      <p class="step-title">${esc(s.title)}</p>
      ${s.text ? `<p class="step-text">${esc(s.text)}</p>` : ''}
    </li>`).join('')}
  </ol>`;
}

function designerPoints(d, bonus) {
  return `<ul class="points">
    ${(d.points || []).map((p) => {
      const text = /бонус/i.test(p.title) && bonus ? `${bonus}% от суммы каждого реализованного проекта.` : p.text;
      return `<li><p class="point-title">${esc(p.title)}</p>${text ? `<p class="point-text">${esc(text)}</p>` : ''}</li>`;
    }).join('')}
  </ul>`;
}

function managers(settings, message) {
  const list = (settings.contacts && settings.contacts.managers) || [];
  if (!list.length) return '<p class="muted">Контакты менеджеров скоро появятся.</p>';
  return `<div class="managers">${list.map((m) => managerCard(m, message)).join('')}</div>`;
}

function crumbs(items) {
  return `<nav class="crumbs wrap" aria-label="Навигация">
    ${items.map(([href, label], i) => (i < items.length - 1
      ? `<a href="${esc(href)}">${esc(label)}</a><span aria-hidden="true">/</span>`
      : `<span aria-current="page">${esc(label)}</span>`)).join('')}
  </nav>`;
}

/* ------------------------------------------------------------------ главная */

function home(data) {
  const { settings, series, products } = data;
  const ctx = { settings, series };
  const h = settings.hero || {};
  const about = settings.about || {};
  const d = settings.designers || {};
  const dev = settings.developers || {};
  const featured = products.filter((p) => p.featured).slice(0, 8);
  const shown = featured.length ? featured : products.slice(0, 8);

  const seriesCards = series
    .map((s) => {
      const items = products.filter((p) => p.seriesId === s.id);
      if (!items.length) return '';
      const cover = items.find((p) => p.featured && p.images && p.images[0]) || items[Math.floor(items.length / 2)];
      const img = s.image || (cover.images && cover.images[0]) || '';
      return `<a class="series-card" href="/catalog?series=${encodeURIComponent(s.id)}">
        <div class="series-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}</div>
        <div class="series-body">
          <p class="series-name">${esc(s.name)}</p>
          <p class="series-count">${items.length} ${plural(items.length, ['коллекция', 'коллекции', 'коллекций'])}</p>
        </div>
      </a>`;
    })
    .join('');

  const body = `
<section class="hero">
  ${h.image ? `<img class="hero-img" src="${esc(h.image)}" alt="" fetchpriority="high">` : ''}
  <div class="hero-shade"></div>
  <div class="wrap hero-content">
    <p class="hero-kicker">${esc(settings.tagline)}${settings.city ? ` · ${esc(settings.city)}` : ''}</p>
    <h1>${esc(h.title)}</h1>
    ${h.subtitle ? `<p class="hero-lead">${esc(h.subtitle)}</p>` : ''}
    <div class="hero-actions">
      ${contactButton('Получить консультацию', 'btn btn-light')}
      <a class="btn btn-outline-light" href="/catalog">Смотреть каталог</a>
    </div>
  </div>
</section>

<section class="section wrap about">
  <div class="about-text">
    <h2>${esc(about.title)}</h2>
    ${about.text ? `<p class="lead">${esc(about.text)}</p>` : ''}
  </div>
  <ul class="features">
    ${(about.points || []).map((p) => `<li><p class="feature-title">${esc(p.title)}</p><p class="feature-text">${esc(p.text)}</p></li>`).join('')}
  </ul>
</section>

<section class="section wrap">
  ${sectionHead('Коллекции', `${products.length} ${plural(products.length, ['коллекция', 'коллекции', 'коллекций'])} в ${series.length} ${plural(series.length, ['серии', 'сериях', 'сериях'])}`, '<a class="more-link" href="/catalog">Весь каталог →</a>')}
  <div class="series-grid">${seriesCards}</div>
</section>

<section class="section wrap">
  ${sectionHead('Популярные материалы', '', '<a class="more-link" href="/catalog">Все материалы →</a>')}
  <div class="grid">${shown.map((p) => card(p, ctx)).join('')}</div>
</section>

<section class="section band">
  <div class="wrap two-col">
    <div>
      <h2>${esc(d.title)}</h2>
      ${d.text ? `<p class="lead">${esc(d.text)}</p>` : ''}
      <div class="actions">
        ${contactButton('Обсудить проект')}
        <a class="btn" href="/designers">Подробнее</a>
      </div>
    </div>
    ${designerPoints(d, settings.calc && settings.calc.designerBonus)}
  </div>
</section>

<section class="section wrap">
  ${sectionHead((settings.process && settings.process.title) || 'Как проходит работа', '')}
  ${steps(settings.process)}
</section>

${(settings.applications || []).length ? `<section class="section wrap">
  ${sectionHead('Где применяется', '')}
  <ul class="apps">${settings.applications.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
</section>` : ''}

<section class="section dark">
  <div class="wrap two-col">
    <div>
      <h2>${esc(dev.title)}</h2>
      ${dev.text ? `<p class="lead">${esc(dev.text)}</p>` : ''}
      ${(dev.audiences || []).length ? `<ul class="tags">${dev.audiences.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    </div>
    <div class="actions actions-end">
      ${waButton(settings, 'Здравствуйте! Хочу получить коммерческое предложение для объекта.', 'Запросить коммерческое предложение', 'btn btn-light')}
      <a class="btn btn-outline-light" href="/developers">Условия для объектов</a>
    </div>
  </div>
</section>

<section class="section wrap">
  ${sectionHead('Контакты', settings.contacts && settings.contacts.showroom ? `Шоурум: ${settings.contacts.showroom}${settings.city ? `, ${settings.city}` : ''}` : '')}
  ${managers(settings)}
</section>`;

  return page({ base: data.base, settings, body, path: '/', active: '/', image: h.image });
}

/* ------------------------------------------------------------------ каталог */

function filterGroup(title, name, items, selected, opts = {}) {
  if (!items.length) return '';
  return `<fieldset class="fgroup">
    <legend>${esc(title)}</legend>
    ${items.map((it) => {
      const value = typeof it === 'object' ? it.value : it;
      const label = typeof it === 'object' ? it.label : it;
      const sw = opts.swatch ? `<i class="swatch" style="background:${esc(opts.swatch(value))}"></i>` : '';
      return `<label class="check"><input type="checkbox" name="${esc(name)}" value="${esc(value)}"${selected.includes(String(value)) ? ' checked' : ''}>${sw}<span>${esc(label)}</span></label>`;
    }).join('')}
  </fieldset>`;
}

function catalog(data, query) {
  const { settings, series, products } = data;
  const ctx = { settings, series };
  const f = facets(products, series);
  const sel = (k) => String(query[k] || '').split(',').filter(Boolean);
  const body = `
<section class="page-head wrap">
  <h1>Каталог материалов</h1>
  <p class="lead">Подберите материал по серии, типу, цвету, фактуре, размеру, толщине и цене. У каждой коллекции — характеристики, цена, наличие и сроки.</p>
</section>

<div class="wrap catalog">
  <div class="filters-backdrop" data-filters-close></div>
  <aside class="filters" id="filters" aria-label="Фильтры">
    <div class="filters-scroll">
    <div class="filters-head">
      <p class="filters-title">Фильтры</p>
      <button class="link-btn" type="button" data-reset>Сбросить</button>
      <button class="modal-close filters-close" type="button" data-filters-close aria-label="Закрыть фильтры">×</button>
    </div>
    <form id="filter-form">
      <fieldset class="fgroup">
        <legend>Наличие</legend>
        <label class="check"><input type="checkbox" name="avail" value="in"${query.avail ? ' checked' : ''}><span>Только в наличии</span></label>
      </fieldset>
      ${filterGroup('Серия', 'series', f.series.map((s) => ({ value: s.id, label: s.name })), sel('series'))}
      ${filterGroup('Тип материала', 'type', f.types, sel('type'))}
      ${filterGroup('Цвет', 'color', f.colors, sel('color'), { swatch: (v) => COLOR_SWATCH[v] || '#ccc' })}
      ${filterGroup('Фактура', 'finish', f.finishes, sel('finish'))}
      ${filterGroup('Размер, мм', 'size', f.sizes.map((s) => ({ value: s, label: s.replace('×', ' × ') })), sel('size'))}
      ${filterGroup('Толщина, мм', 'thickness', f.thickness.map((t) => ({ value: String(t), label: `${num(t)} мм` })), sel('thickness'))}
      <fieldset class="fgroup">
        <legend>Цена за м², ₸</legend>
        ${f.priceMin === null
          ? '<p class="muted small">Цены уточняйте у менеджера</p>'
          : `<div class="range">
              <input type="number" name="pmin" inputmode="numeric" min="0" placeholder="от ${esc(num(f.priceMin))}" value="${esc(query.pmin || '')}" aria-label="Цена от">
              <span>—</span>
              <input type="number" name="pmax" inputmode="numeric" min="0" placeholder="до ${esc(num(f.priceMax))}" value="${esc(query.pmax || '')}" aria-label="Цена до">
            </div>`}
      </fieldset>
    </form>
    </div>
    <div class="filters-footer"><button class="btn btn-primary filters-apply" type="button" data-filters-close>Показать</button></div>
  </aside>

  <div class="catalog-main">
    <div class="catalog-bar">
      <input class="search" type="search" id="search" placeholder="Поиск по названию или артикулу" value="${esc(query.q || '')}" aria-label="Поиск">
      <button class="btn filters-open" type="button" data-filters-open>Фильтры</button>
      <select id="sort" aria-label="Сортировка">
        <option value="">Сначала популярные</option>
        <option value="name"${query.sort === 'name' ? ' selected' : ''}>По названию</option>
        <option value="price-asc"${query.sort === 'price-asc' ? ' selected' : ''}>Сначала дешевле</option>
        <option value="price-desc"${query.sort === 'price-desc' ? ' selected' : ''}>Сначала дороже</option>
        <option value="stock"${query.sort === 'stock' ? ' selected' : ''}>Сначала в наличии</option>
      </select>
    </div>
    <p class="found" id="found">Найдено: ${products.length} ${plural(products.length, ['коллекция', 'коллекции', 'коллекций'])}</p>
    <div class="grid grid-3" id="grid">${products.map((p) => card(p, ctx)).join('')}</div>
    <div class="empty" id="empty" hidden>
      <p>По этим параметрам ничего не нашлось.</p>
      <button class="btn" type="button" data-reset>Сбросить фильтры</button>
    </div>
  </div>
</div>`;
  return page({ base: data.base, settings, body, title: 'Каталог материалов', path: '/catalog', active: '/catalog' });
}

/* ------------------------------------------------------------ калькулятор */

function calcData(products, settings, series) {
  return {
    bonus: (settings.calc && settings.calc.designerBonus) || 0,
    waste: (settings.calc && settings.calc.defaultWaste) || 10,
    wa: (primaryManager(settings) || {}).whatsapp || '',
    products: products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      article: p.article,
      series: (seriesOf(p, series) || {}).name || '',
      price: typeof p.price === 'number' && p.price > 0 ? p.price : null,
      sizes: (p.sizes || []).map((s) => ({ label: s.replace('×', ' × '), area: sizeArea(s) })).filter((s) => s.area),
    })),
  };
}

function calcBlock(settings, { withMaterial, series, products, selected }) {
  const waste = (settings.calc && settings.calc.defaultWaste) || 10;
  const bonus = (settings.calc && settings.calc.designerBonus) || 0;
  const wasteOpts = [...new Set([5, 10, 15, waste])].sort((a, b) => a - b);
  const groups = withMaterial
    ? series
      .map((s) => {
        const items = products.filter((p) => p.seriesId === s.id);
        if (!items.length) return '';
        return `<optgroup label="${esc(s.name)}">${items.map((p) => `<option value="${esc(p.id)}"${selected === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`;
      })
      .join('') + products.filter((p) => !series.some((s) => s.id === p.seriesId)).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')
    : '';
  return `<div class="calc" data-calc${selected ? ` data-product="${esc(selected)}"` : ''}>
    <div class="calc-form">
      ${withMaterial ? `<label class="field"><span>Материал</span><select data-calc-material>${groups}</select></label>` : ''}
      <label class="field"><span>Площадь по проекту, м²</span><input type="number" data-calc-area min="0" step="0.5" inputmode="decimal" value="20"></label>
      <label class="field"><span>Формат плиты</span><select data-calc-size></select></label>
      <label class="field"><span>Запас на подрезку</span><select data-calc-waste>
        ${wasteOpts.map((w) => `<option value="${w}"${w === waste ? ' selected' : ''}>${w}%</option>`).join('')}
      </select></label>
    </div>
    <div class="calc-result" aria-live="polite">
      <div class="calc-row"><span>Нужно плит</span><b data-out="plates">—</b></div>
      <div class="calc-row"><span>Площадь материала с запасом</span><b data-out="area">—</b></div>
      <div class="calc-row calc-total"><span>Ориентировочная стоимость</span><b data-out="cost">—</b></div>
      ${bonus ? `<div class="calc-row calc-bonus"><span>Ориентировочный бонус дизайнера, ${esc(num(bonus))}%</span><b data-out="bonus">—</b></div>` : ''}
      <p class="calc-note" data-out="note">Количество округляется до целой плиты. Итоговую сумму подтвердит менеджер.</p>
      <a class="btn btn-primary" data-calc-send href="#" target="_blank" rel="noopener" hidden>Отправить расчёт менеджеру</a>
      <button class="btn btn-primary" type="button" data-contact data-calc-send-fallback>Отправить расчёт менеджеру</button>
    </div>
  </div>`;
}

function calculator(data, query) {
  const { settings, series, products } = data;
  const selected = products.find((p) => p.id === query.m || p.slug === query.m);
  const body = `
<section class="page-head wrap">
  <h1>Калькулятор</h1>
  <p class="lead">Укажите площадь и материал — калькулятор покажет, сколько нужно плит, ориентировочную стоимость и ваш бонус дизайнера.</p>
</section>
<section class="wrap section-tight">
  ${calcBlock(settings, { withMaterial: true, series, products, selected: selected ? selected.id : (products[0] || {}).id })}
</section>`;
  return page({
    base: data.base, settings, body, title: 'Калькулятор', path: '/calculator', active: '/calculator',
    jsonData: calcData(products, settings, series),
  });
}

/* ---------------------------------------------------------------- карточка */

function product(data, slug) {
  const { settings, series, products } = data;
  const raw = products.find((p) => p.slug === slug);
  if (!raw) return null;
  const p = effective(raw, settings);
  const s = seriesOf(p, series);
  const a = availability(p, settings);
  const imgs = p.images || [];
  const msg = `Здравствуйте! Интересует ${p.name}${p.article ? ` (артикул ${p.article})` : ''}. Подскажите цену, наличие и сроки.`;
  const sampleMsg = `Здравствуйте! Хочу получить образец ${p.name}${p.article ? ` (артикул ${p.article})` : ''}.`;
  const facts = [
    ['Фактура', p.finish],
    ['Цвет', p.color],
    ['Размеры', sizesText(p) ? `${sizesText(p)} мм` : ''],
    ['Толщина', thicknessText(p)],
    ['Тип материала', p.type],
  ].filter(([, v]) => v);
  const specRows = [
    ['Состав', p.composition || 'Уточняйте у менеджера'],
    ['Страна', p.country || 'Уточняйте у менеджера'],
    ['Производство', p.factory || 'Уточняйте у менеджера'],
    ...(p.body ? [['Основа плиты', p.body]] : []),
    ...p.specs.filter((x) => !/^основа плиты$/i.test(x.name)).map((x) => [x.name, x.value]),
  ];
  const related = products.filter((x) => x.seriesId === p.seriesId && x.id !== p.id).slice(0, 4);
  const unknown = 'Уточняйте';

  const body = `
${crumbs([['/', 'Главная'], ['/catalog', 'Каталог'], ...(s ? [[`/catalog?series=${s.id}`, s.name]] : []), ['', p.name]])}

<section class="wrap product">
  <div class="gallery">
    <div class="gallery-main">${imgs[0] ? `<img id="gallery-main" src="${esc(imgs[0])}" alt="${esc(p.name)}">` : '<div class="noimg">Фото скоро появится</div>'}</div>
    ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((src, i) => `<button type="button" class="thumb${i === 0 ? ' is-active' : ''}" data-src="${esc(src)}" aria-label="Фото ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
  </div>

  <div class="product-info">
    ${s ? `<p class="card-series">${esc(s.name)}</p>` : ''}
    <h1 class="product-title">${esc(p.name)}</h1>
    ${p.article ? `<p class="article">Артикул ${esc(p.article)}</p>` : ''}

    <dl class="facts">
      ${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
    </dl>

    <div class="price-box">
      <p class="price">${typeof p.price === 'number' && p.price > 0 ? `${money(p.price)} <span>за м²</span>` : 'Цена по запросу'}</p>
    </div>

    <div class="stock-box">
      <p class="badge badge-${a.key}">${esc(a.label)}</p>
      <dl class="stock-list">
        <div><dt>Сейчас на складе</dt><dd>${typeof p.stock === 'number' ? `${num(p.stock)} м²` : unknown}</dd></div>
        <div><dt>Когда можно получить</dt><dd>${esc(p.readyIn || (typeof p.stock === 'number' && p.stock > 0 ? 'Уточняйте у менеджера' : unknown))}</dd></div>
        <div><dt>Срок поставки под заказ</dt><dd>${esc(p.leadTime || unknown)}</dd></div>
        ${p.arrival ? `<div><dt>Ожидается поступление</dt><dd>${esc(p.arrival)}</dd></div>` : ''}
      </dl>
    </div>

    <div class="actions">
      ${waButton(settings, msg, 'Написать по этому материалу')}
      ${waButton(settings, sampleMsg, 'Запросить образец', 'btn')}
    </div>
  </div>
</section>

<section class="wrap section-tight">
  <h2 class="h3">Расчёт по проекту</h2>
  ${calcBlock(settings, { withMaterial: false, series, products, selected: p.id })}
</section>

<section class="wrap section-tight specs">
  <div>
    <h2 class="h3">Характеристики</h2>
    <table class="spec-table"><tbody>
      ${specRows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div>
    ${p.usage ? `<h2 class="h3">Применение</h2><p class="text">${esc(p.usage)}</p>` : ''}
    ${p.description ? `<h2 class="h3">Описание</h2><p class="text pre">${esc(p.description)}</p>` : ''}
    ${!p.usage && !p.description && s && s.description ? `<h2 class="h3">О серии «${esc(s.name)}»</h2><p class="text">${esc(s.description)}</p>` : ''}
  </div>
</section>

${related.length ? `<section class="section wrap">
  ${sectionHead(`Другие коллекции серии «${s ? s.name : ''}»`, '', s ? `<a class="more-link" href="/catalog?series=${esc(s.id)}">Вся серия →</a>` : '')}
  <div class="grid">${related.map((x) => card(x, { settings, series })).join('')}</div>
</section>` : ''}`;

  return page({
    base: data.base, settings, body, title: p.name,
    description: `${p.name}${p.article ? `, артикул ${p.article}` : ''}. ${[p.finish, sizesText(p) && `${sizesText(p)} мм`, thicknessText(p)].filter(Boolean).join(', ')}. ${priceText(p)}. ${a.label}.`,
    path: `/catalog/${p.slug}`, active: '/catalog', image: imgs[0],
    jsonData: calcData([raw], settings, series),
  });
}

/* ----------------------------------------------------------- наличие */

function stock(data, query) {
  const { settings, series, products } = data;
  const rank = { in: 0, low: 1, order: 2, unknown: 3 };
  const rows = products
    .map((p) => ({ p, a: availability(p, settings), s: seriesOf(p, series) }))
    .sort((x, y) => rank[x.a.key] - rank[y.a.key] || (y.p.stock || 0) - (x.p.stock || 0) || x.p.name.localeCompare(y.p.name, 'ru'));
  const filled = rows.some((r) => r.a.key !== 'unknown');
  const body = `
<section class="page-head wrap">
  <h1>Наличие и сроки</h1>
  <p class="lead">Есть ли материал сейчас → сколько м² → когда можно получить → срок поставки, если материала нет.</p>
</section>
<section class="wrap section-tight">
  <div class="stock-tools">
    <input class="search" type="search" id="stock-search" placeholder="Найти коллекцию" aria-label="Найти коллекцию">
    <label class="check"><input type="checkbox" id="stock-only"${query.avail ? ' checked' : ''}><span>Только в наличии</span></label>
  </div>
  ${filled ? '' : '<p class="note">Остатки ещё не заполнены. Напишите менеджеру — проверим наличие по нужной коллекции.</p>'}
  <div class="table-wrap">
    <table class="stock-table">
      <thead><tr><th>Коллекция</th><th>Серия</th><th>Сейчас на складе</th><th>Когда можно получить</th><th>Срок поставки</th><th>Ожидается</th></tr></thead>
      <tbody>
        ${rows.map(({ p, a, s }) => `<tr data-avail="${a.key}" data-search="${esc((p.name + ' ' + (p.article || '')).toLowerCase())}">
          <td><a href="/catalog/${esc(p.slug)}">${esc(p.name)}</a>${p.article ? `<small>${esc(p.article)}</small>` : ''}</td>
          <td>${esc(s ? s.name : '')}</td>
          <td><span class="badge badge-${a.key}">${esc(a.short)}</span></td>
          <td>${esc(p.readyIn || '—')}</td>
          <td>${esc(p.leadTime || '—')}</td>
          <td>${esc(p.arrival || '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="actions">${contactButton('Проверить наличие у менеджера')}</div>
</section>`;
  return page({ base: data.base, settings, body, title: 'Наличие и сроки', path: '/stock', active: '/stock' });
}

/* ----------------------------------------------------- дизайнерам, ЖК, контакты */

function designers(data) {
  const { settings } = data;
  const d = settings.designers || {};
  const bonus = settings.calc && settings.calc.designerBonus;
  const body = `
<section class="page-head wrap">
  <h1>${esc(d.title)}</h1>
  ${d.text ? `<p class="lead">${esc(d.text)}</p>` : ''}
  <div class="actions">${contactButton('Обсудить проект')}<a class="btn" href="/calculator">Посчитать проект</a></div>
</section>
<section class="wrap section-tight">
  <h2 class="h3">Что вы получаете</h2>
  ${designerPoints(d, bonus)}
</section>
${bonus ? `<section class="wrap section-tight">
  <div class="bonus-box">
    <p class="bonus-value">${esc(num(bonus))}%</p>
    <div><p class="point-title">Бонус за проект</p><p class="point-text">От суммы каждого реализованного проекта. Ориентировочный бонус видно сразу в калькуляторе и в карточке материала.</p></div>
  </div>
</section>` : ''}
<section class="section wrap">
  ${sectionHead((settings.process && settings.process.title) || 'Как проходит работа', '')}
  ${steps(settings.process)}
</section>`;
  return page({ base: data.base, settings, body, title: d.title || 'Дизайнерам', path: '/designers', active: '/designers' });
}

function developers(data) {
  const { settings } = data;
  const d = settings.developers || {};
  const body = `
<section class="page-head wrap">
  <h1>${esc(d.title)}</h1>
  ${d.text ? `<p class="lead">${esc(d.text)}</p>` : ''}
  <div class="actions">${waButton(settings, 'Здравствуйте! Хочу получить коммерческое предложение для объекта.', 'Запросить коммерческое предложение')}</div>
</section>
<section class="wrap section-tight two-col">
  <div>
    <h2 class="h3">Для кого</h2>
    <ul class="tags tags-dark">${(d.audiences || []).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
  </div>
  <div>
    <h2 class="h3">Условия</h2>
    <ul class="checklist">${(d.points || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  </div>
</section>
<section class="section wrap">
  ${sectionHead((settings.process && settings.process.title) || 'Как проходит работа', '')}
  ${steps(settings.process)}
</section>`;
  return page({ base: data.base, settings, body, title: d.title || 'ЖК и застройщикам', path: '/developers', active: '/developers' });
}

function contacts(data) {
  const { settings } = data;
  const c = settings.contacts || {};
  const ig = c.instagram ? `https://instagram.com/${encodeURIComponent(c.instagram)}` : '';
  const body = `
<section class="page-head wrap">
  <h1>Контакты</h1>
  <p class="lead">Напишите или позвоните — подберём материал, проверим наличие и посчитаем проект.</p>
</section>
<section class="wrap section-tight">
  ${managers(settings)}
</section>
<section class="wrap section-tight">
  <div class="info-grid">
    ${c.showroom ? `<div><p class="info-label">Шоурум</p><p class="info-value">${esc(c.showroom)}</p>${settings.city ? `<p class="muted">${esc(settings.city)}</p>` : ''}${c.mapUrl ? `<p><a href="${esc(c.mapUrl)}" target="_blank" rel="noopener">Открыть на карте</a></p>` : ''}</div>` : ''}
    ${c.hours ? `<div><p class="info-label">Часы работы</p><p class="info-value">${esc(c.hours)}</p></div>` : ''}
    ${ig ? `<div><p class="info-label">Instagram</p><p class="info-value"><a href="${esc(ig)}" target="_blank" rel="noopener">@${esc(c.instagram)}</a></p></div>` : ''}
  </div>
</section>`;
  return page({ base: data.base, settings, body, title: 'Контакты', path: '/contacts', active: '/contacts' });
}

function notFound(data) {
  const body = `<section class="page-head wrap">
    <h1>Страница не найдена</h1>
    <p class="lead">Возможно, коллекция снята с продажи или ссылка устарела.</p>
    <div class="actions"><a class="btn btn-primary" href="/catalog">Перейти в каталог</a></div>
  </section>`;
  return page({ base: data.base, settings: data.settings, body, title: 'Страница не найдена' });
}

module.exports = { home, catalog, product, calculator, stock, designers, developers, contacts, notFound };
