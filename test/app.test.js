'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'vistone-test-'));
process.env.DATA_DIR = DATA;
process.env.ADMIN_PASSWORD = 'correct-horse-9';

const { createApp } = require('../server');
const { deltaE, hexToLab } = require('../public/js/match');
const { hasSharp } = require('../src/palette');

let base;
let server;
let cookie = '';

async function call(method, url, body, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.auth !== false && cookie) headers.cookie = cookie;
  if (opts.csrf !== false && method !== 'GET') headers['x-requested-with'] = 'vistone-admin';
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* страница, не JSON */ }
  return { status: res.status, text, json, headers: res.headers };
}

test.before(async () => {
  const app = createApp();
  await app.locals.ready;
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
  server.close();
  fs.rmSync(DATA, { recursive: true, force: true });
});

test('публичные страницы открываются', async () => {
  for (const url of ['/', '/catalog', '/combine', '/calculator', '/stock', '/designers', '/developers', '/contacts', '/sitemap.xml', '/robots.txt']) {
    const r = await call('GET', url, undefined, { auth: false });
    assert.equal(r.status, 200, url);
  }
  const cat = await call('GET', '/catalog', undefined, { auth: false });
  assert.match(cat.text, /Terrazzo/);
  assert.equal((cat.text.match(/class="card"/g) || []).length, 54);
});

test('карточка коллекции содержит поля из ТЗ', async () => {
  const r = await call('GET', '/catalog/terrazzo', undefined, { auth: false });
  assert.equal(r.status, 200);
  for (const s of ['Артикул SMG123606PB03M', 'Фактура', 'Цвет', 'Размеры', 'Толщина', 'Состав', 'Страна', 'Производство', 'Цена по запросу', 'Сейчас на складе', 'Когда можно получить', 'Срок поставки под заказ']) {
    assert.ok(r.text.includes(s), `нет «${s}»`);
  }
  const missing = await call('GET', '/catalog/net-takoy', undefined, { auth: false });
  assert.equal(missing.status, 404);
});

test('подбор сочетаний: страница, цвета по фото, блок в карточке', async () => {
  const r = await call('GET', '/combine?m=salorant,light-tan', undefined, { auth: false });
  assert.equal(r.status, 200);
  assert.equal((r.text.match(/class="pick"/g) || []).length, 54);
  assert.match(r.text, /\/assets\/js\/match\.js/);
  const data = JSON.parse(r.text.match(/<script type="application\/json" id="page-data">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(data.selected, ['salorant', 'light-tan']);
  const salorant = data.items.find((x) => x.slug === 'salorant');
  assert.match(salorant.tone, /^#[0-9a-f]{6}$/);
  assert.ok(salorant.tone < '#606060', `тон чёрного мрамора по фото: ${salorant.tone}`);

  const page = await call('GET', '/catalog/salorant', undefined, { auth: false });
  assert.match(page.text, /С чем сочетается/);
  assert.match(page.text, /href="\/combine\?m=salorant,[a-z0-9-]+"/);
  const home = await call('GET', '/', undefined, { auth: false });
  assert.match(home.text, /Подбор сочетаний/);
});

test('API админки закрыто без входа', async () => {
  const r = await call('GET', '/api/admin/state', undefined, { auth: false });
  assert.equal(r.status, 401);
});

test('неверный пароль не пускает', async () => {
  const r = await call('POST', '/api/admin/login', { password: 'wrong' }, { auth: false });
  assert.equal(r.status, 401);
});

test('вход по паролю', async () => {
  const r = await call('POST', '/api/admin/login', { password: 'correct-horse-9' }, { auth: false });
  assert.equal(r.status, 200);
  cookie = r.headers.get('set-cookie').split(';')[0];
  assert.match(cookie, /^vs_admin=/);
  const s = await call('GET', '/api/admin/state');
  assert.equal(s.status, 200);
  assert.equal(s.json.products.length, 54);
  assert.equal(s.json.admin, undefined, 'хэш пароля не должен уходить в браузер');
});

test('изменения без служебного заголовка отклоняются', async () => {
  const r = await call('PUT', '/api/admin/settings', {}, { csrf: false });
  assert.equal(r.status, 403);
});

test('цена и наличие из админки появляются на сайте', async () => {
  const st = await call('GET', '/api/admin/state');
  const p = st.json.products.find((x) => x.slug === 'salorant');
  const r = await call('PUT', `/api/admin/products/${p.id}`, { price: 38500, stock: 120, readyIn: 'Доставка 1–3 дня', leadTime: '5–6 недель' });
  assert.equal(r.status, 200);
  const page = await call('GET', '/catalog/salorant', undefined, { auth: false });
  assert.match(page.text, /38\s500 ₸/);
  assert.match(page.text, /В наличии 120 м²/);
  assert.match(page.text, /Доставка 1–3 дня/);
});

test('массовое обновление: остаток 0 — «Под заказ», скрытая коллекция пропадает', async () => {
  const st = await call('GET', '/api/admin/state');
  const a = st.json.products.find((x) => x.slug === 'desert');
  const b = st.json.products.find((x) => x.slug === 'white-rust');
  const r = await call('PATCH', '/api/admin/products', { rows: [{ id: a.id, stock: 0, leadTime: '8 недель' }, { id: b.id, hidden: true }] });
  assert.equal(r.json.updated, 2);
  const pa = await call('GET', '/catalog/desert', undefined, { auth: false });
  assert.match(pa.text, /Под заказ · 8 недель/);
  const pb = await call('GET', '/catalog/white-rust', undefined, { auth: false });
  assert.equal(pb.status, 404);
  const cat = await call('GET', '/catalog', undefined, { auth: false });
  assert.equal((cat.text.match(/class="card"/g) || []).length, 53);
});

test('новая коллекция: создание, адрес страницы, удаление', async () => {
  const c = await call('POST', '/api/admin/products', { name: 'Нерo Тест', seriesId: 'premium', sizes: ['1200 x 2400'], thickness: ['6'] });
  assert.equal(c.status, 201);
  assert.equal(c.json.product.slug, 'nero-test');
  assert.deepEqual(c.json.product.sizes, ['1200×2400']);
  const page = await call('GET', '/catalog/nero-test', undefined, { auth: false });
  assert.equal(page.status, 200);
  const d = await call('DELETE', `/api/admin/products/${c.json.product.id}`);
  assert.equal(d.status, 200);
  const gone = await call('GET', '/catalog/nero-test', undefined, { auth: false });
  assert.equal(gone.status, 404);
});

test('тон и рисунок для подбора: проверка ввода, цвет по новому фото', { skip: !hasSharp && 'sharp не установлен' }, async () => {
  const st = await call('GET', '/api/admin/state');
  const p = st.json.products.find((x) => x.slug === 'terrazzo');
  assert.match(p.palette.tone, /^#[0-9a-f]{6}$/);
  assert.equal(p.palette.image, p.images[0]);

  const bad = await call('PUT', `/api/admin/products/${p.id}`, { tone: 'red', pattern: 'weird' });
  assert.equal(bad.json.product.tone, '');
  assert.equal(bad.json.product.pattern, '');
  const ok = await call('PUT', `/api/admin/products/${p.id}`, { tone: '#ABCDEF', pattern: 'calm' });
  assert.equal(ok.json.product.tone, '#abcdef');
  assert.equal(ok.json.product.pattern, 'calm');
  const page = await call('GET', '/combine', undefined, { auth: false });
  assert.match(page.text, /"slug":"terrazzo"[^}]*"tone":"#abcdef"[^}]*"pattern":"calm"/);
  await call('PUT', `/api/admin/products/${p.id}`, { tone: '', pattern: '' });

  // новое главное фото — цвет пересчитывается при сохранении
  const color = '#2e4a6b';
  const png = await require('sharp')({ create: { width: 40, height: 40, channels: 3, background: color } }).png().toBuffer();
  const fd = new FormData();
  fd.append('files', new Blob([png], { type: 'image/png' }), 'blue.png');
  const up = await call('POST', '/api/admin/upload', fd);
  const near = (hex) => deltaE(hexToLab(hex), hexToLab(color)) < 2;
  const preview = await call('POST', '/api/admin/palette', { url: up.json.urls[0] });
  assert.ok(near(preview.json.palette.tone), preview.json.palette.tone);
  const c = await call('POST', '/api/admin/products', { name: 'Тест цвета', images: up.json.urls });
  assert.ok(near(c.json.product.palette.tone), c.json.product.palette.tone);
  const removed = await call('PUT', `/api/admin/products/${c.json.product.id}`, { images: [] });
  assert.equal(removed.json.product.palette, undefined);
  await call('DELETE', `/api/admin/products/${c.json.product.id}`);
});

test('без названия коллекцию не сохранить', async () => {
  const r = await call('POST', '/api/admin/products', { name: '   ' });
  assert.equal(r.status, 400);
});

test('тексты экранируются', async () => {
  const st = await call('GET', '/api/admin/state');
  const settings = st.json.settings;
  settings.hero.title = '<script>alert(1)</script>';
  const r = await call('PUT', '/api/admin/settings', settings);
  assert.equal(r.status, 200);
  const home = await call('GET', '/', undefined, { auth: false });
  assert.ok(!home.text.includes('<script>alert(1)</script>'));
  assert.ok(home.text.includes('&lt;script&gt;'));
});

test('контакты из админки: WhatsApp-ссылка на сайте', async () => {
  const st = await call('GET', '/api/admin/state');
  const settings = st.json.settings;
  settings.contacts.managers[0].whatsapp = '+7 701 123-45-67';
  settings.contacts.managers[0].phone = '+7 701 123 45 67';
  await call('PUT', '/api/admin/settings', settings);
  const page = await call('GET', '/contacts', undefined, { auth: false });
  assert.match(page.text, /https:\/\/wa\.me\/77011234567/);
});

test('загрузка фото: принимается картинка, отклоняется не-картинка', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const fd = new FormData();
  fd.append('files', new Blob([png], { type: 'image/png' }), 'dot.png');
  const ok = await call('POST', '/api/admin/upload', fd);
  assert.equal(ok.status, 200);
  assert.match(ok.json.urls[0], /^\/uploads\/[a-f0-9]+\.(jpg|png)$/);
  const img = await fetch(base + ok.json.urls[0]);
  assert.equal(img.status, 200);

  const bad = new FormData();
  bad.append('files', new Blob(['<html>'], { type: 'image/png' }), 'fake.png');
  const no = await call('POST', '/api/admin/upload', bad);
  assert.equal(no.status, 400);
});

test('смена пароля', async () => {
  const wrong = await call('POST', '/api/admin/password', { current: 'nope', next: 'new-password-1' });
  assert.equal(wrong.status, 400);
  const ok = await call('POST', '/api/admin/password', { current: 'correct-horse-9', next: 'new-password-1' });
  assert.equal(ok.status, 200);
  const login = await call('POST', '/api/admin/login', { password: 'new-password-1' }, { auth: false });
  assert.equal(login.status, 200);
});

test('данные переживают перезапуск', async () => {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'db.json'), 'utf8'));
  const p = raw.products.find((x) => x.slug === 'salorant');
  assert.equal(p.price, 38500);
  assert.ok(raw.admin.password.hash);
});
