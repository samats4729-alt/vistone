'use strict';

const { esc, digits } = require('../util');

const NAV = [
  ['/catalog', 'Каталог'],
  ['/calculator', 'Калькулятор'],
  ['/stock', 'Наличие и сроки'],
  ['/designers', 'Дизайнерам'],
  ['/developers', 'ЖК и застройщикам'],
  ['/contacts', 'Контакты'],
];

function waHref(manager, text) {
  const n = digits(manager && manager.whatsapp);
  if (!n) return '';
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Первый менеджер, у которого указан WhatsApp, — ему уходят сообщения с сайта. */
function primaryManager(settings) {
  const list = (settings.contacts && settings.contacts.managers) || [];
  return list.find((m) => digits(m.whatsapp)) || null;
}

function telHref(phone) {
  const d = digits(phone);
  return d ? `tel:+${d}` : '';
}

function managerCard(m, message) {
  const wa = waHref(m, message || 'Здравствуйте! Хочу получить консультацию по материалам VISTONE.');
  const tel = telHref(m.phone);
  return `<div class="manager">
    <p class="manager-name">${esc(m.name)}</p>
    <p class="manager-role">${esc(m.role)}</p>
    ${m.phone ? `<p class="manager-phone"><a href="${esc(tel)}">${esc(m.phone)}</a></p>` : ''}
    <div class="manager-actions">
      ${wa ? `<a class="btn btn-primary btn-sm" href="${esc(wa)}" target="_blank" rel="noopener">Написать в WhatsApp</a>` : ''}
      ${tel ? `<a class="btn btn-sm" href="${esc(tel)}">Позвонить</a>` : ''}
    </div>
  </div>`;
}

function contactModal(settings) {
  const c = settings.contacts || {};
  const list = c.managers || [];
  const ig = c.instagram ? `https://instagram.com/${encodeURIComponent(c.instagram)}` : '';
  return `<div class="modal" id="contact-modal" hidden>
  <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="contact-title">
    <div class="modal-head">
      <h2 id="contact-title">Получить консультацию</h2>
      <button class="modal-close" type="button" data-close aria-label="Закрыть">×</button>
    </div>
    <p class="modal-lead">Напишите или позвоните — подберём материал, проверим наличие и посчитаем проект.</p>
    <div class="managers managers-stack">
      ${list.length ? list.map((m) => managerCard(m)).join('') : '<p class="muted">Контакты менеджеров скоро появятся.</p>'}
    </div>
    <p class="modal-foot">
      ${c.showroom ? `Шоурум: ${esc(c.showroom)}${settings.city ? `, ${esc(settings.city)}` : ''}` : ''}
      ${ig ? ` · <a href="${esc(ig)}" target="_blank" rel="noopener">Instagram @${esc(c.instagram)}</a>` : ''}
    </p>
  </div>
</div>`;
}

function header(settings, active) {
  return `<header class="site-header">
  <div class="wrap header-row">
    <a class="logo" href="/" aria-label="${esc(settings.siteName)} — на главную">${esc(settings.siteName)}</a>
    <nav class="nav" id="nav" aria-label="Разделы сайта">
      ${NAV.map(([href, label]) => `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
    </nav>
    <button class="btn btn-primary btn-sm header-cta" type="button" data-contact>Получить консультацию</button>
    <button class="burger" type="button" aria-controls="nav" aria-expanded="false" aria-label="Меню"><span></span><span></span><span></span></button>
  </div>
</header>`;
}

function footer(settings) {
  const c = settings.contacts || {};
  const ig = c.instagram ? `https://instagram.com/${encodeURIComponent(c.instagram)}` : '';
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="logo logo-light">${esc(settings.siteName)}</p>
      <p class="footer-text">${esc(settings.tagline)}${settings.city ? ` · ${esc(settings.city)}` : ''}</p>
    </div>
    <div>
      <p class="footer-title">Разделы</p>
      ${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
    </div>
    <div>
      <p class="footer-title">Шоурум</p>
      ${c.showroom ? `<p>${esc(c.showroom)}</p>` : ''}
      ${c.hours ? `<p>${esc(c.hours)}</p>` : ''}
      ${ig ? `<a href="${esc(ig)}" target="_blank" rel="noopener">Instagram @${esc(c.instagram)}</a>` : ''}
      <button class="link-btn" type="button" data-contact>Написать нам</button>
    </div>
  </div>
</footer>`;
}

// Меняется при каждом запуске сервера — браузеры подхватывают новые стили и скрипты после обновления сайта.
const V = Date.now().toString(36);

function page({ base, settings, title, description, path, body, active, image, jsonData }) {
  const abs = (u) => { try { return u && base ? new URL(u, base).href : u; } catch { return u; } };
  const fullTitle = title ? `${title} — ${settings.siteName}` : (settings.seo && settings.seo.title) || settings.siteName;
  const desc = description || (settings.seo && settings.seo.description) || settings.tagline;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
${image ? `<meta property="og:image" content="${esc(abs(image))}">` : ''}
${path ? `<meta property="og:url" content="${esc(abs(path))}">\n<link rel="canonical" href="${esc(abs(path))}">` : ''}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Golos+Text:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/assets/css/site.css?v=${V}">
</head>
<body>
${header(settings, active)}
<main>
${body}
</main>
${footer(settings)}
${contactModal(settings)}
${jsonData ? `<script type="application/json" id="page-data">${JSON.stringify(jsonData).replace(/</g, '\\u003c')}</script>` : ''}
<script src="/assets/js/site.js?v=${V}" defer></script>
</body>
</html>`;
}

module.exports = { V, page, managerCard, waHref, primaryManager, telHref };
