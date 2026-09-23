'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');

const store = require('./src/store');
const auth = require('./src/auth');
const images = require('./src/images');
const pages = require('./src/render/pages');
const { V } = require('./src/render/layout');
const fs = require('fs');
const { cleanProduct, cleanSeries, cleanSettings } = require('./src/validate');

function createApp() {
  store.init();
  ensurePassword();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
  app.use('/uploads', express.static(store.UPLOADS_DIR, { maxAge: '7d' }));

  /* ------------------------------------------------------------ сайт */
  const html = (res, out) => res.type('html').send(out);
  const view = (req) => ({ ...store.publicView(), base: `${req.protocol}://${req.get('host')}` });
  const adminHtml = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8')
    .replace('/assets/css/admin.css', `/assets/css/admin.css?v=${V}`)
    .replace('/assets/js/admin.js', `/assets/js/admin.js?v=${V}`);

  app.get('/', (req, res) => html(res, pages.home(view(req))));
  app.get('/catalog', (req, res) => html(res, pages.catalog(view(req), req.query)));
  app.get('/catalog/:slug', (req, res) => {
    const out = pages.product(view(req), req.params.slug);
    if (!out) return res.status(404).type('html').send(pages.notFound(view(req)));
    html(res, out);
  });
  app.get('/calculator', (req, res) => html(res, pages.calculator(view(req), req.query)));
  app.get('/stock', (req, res) => html(res, pages.stock(view(req), req.query)));
  app.get('/designers', (req, res) => html(res, pages.designers(view(req))));
  app.get('/developers', (req, res) => html(res, pages.developers(view(req))));
  app.get('/contacts', (req, res) => html(res, pages.contacts(view(req))));

  app.get('/robots.txt', (req, res) => {
    const base = `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`);
  });
  app.get('/sitemap.xml', (req, res) => {
    const base = `${req.protocol}://${req.get('host')}`;
    const urls = ['/', '/catalog', '/calculator', '/stock', '/designers', '/developers', '/contacts',
      ...store.publicView().products.map((p) => `/catalog/${p.slug}`)];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${base}${encodeURI(u)}</loc></url>`).join('\n')}
</urlset>`);
  });

  /* ------------------------------------------------------------ админка */
  app.get('/admin', (req, res) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(adminHtml);
  });

  const api = express.Router();
  api.use(express.json({ limit: '2mb' }));
  api.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  api.post('/login', (req, res) => {
    const ip = req.ip || 'unknown';
    if (auth.tooManyAttempts(ip)) return res.status(429).json({ error: 'Слишком много попыток. Подождите 15 минут.' });
    const ok = auth.verifyPassword((req.body && req.body.password) || '', store.get().admin.password);
    if (!ok) {
      auth.noteFailure(ip);
      return res.status(401).json({ error: 'Неверный пароль' });
    }
    auth.clearFailures(ip);
    auth.createSession(res, req);
    res.json({ ok: true });
  });

  api.get('/session', (req, res) => res.json({ authed: auth.isAuthed(req) }));

  api.use(auth.requireAdmin);

  api.post('/logout', (req, res) => {
    auth.destroySession(req, res);
    res.json({ ok: true });
  });

  api.get('/state', (req, res) => {
    const { settings, series, products } = store.get();
    res.json({ settings, series, products, sharp: images.hasSharp });
  });

  api.put('/settings', async (req, res, next) => {
    try {
      const settings = cleanSettings(req.body);
      const old = store.get().settings;
      await store.update((db) => { db.settings = settings; });
      if (old.hero && old.hero.image !== settings.hero.image) images.removeIfUnused(old.hero.image, store.get());
      res.json({ settings });
    } catch (e) { next(e); }
  });

  api.put('/series', async (req, res, next) => {
    try {
      const series = cleanSeries(req.body && req.body.series);
      if (!series.length) return res.status(400).json({ error: 'Нужна хотя бы одна серия' });
      await store.update((db) => {
        db.series = series;
        const ids = new Set(series.map((s) => s.id));
        db.products.forEach((p) => { if (!ids.has(p.seriesId)) p.seriesId = ''; });
      });
      res.json({ series });
    } catch (e) { next(e); }
  });

  api.post('/products', async (req, res, next) => {
    try {
      const db = store.get();
      const clean = cleanProduct(req.body || {}, db, null);
      const product = {
        id: crypto.randomBytes(6).toString('hex'),
        ...clean,
        order: clean.order || db.products.reduce((m, p) => Math.max(m, p.order || 0), 0) + 1,
      };
      await store.update((d) => { d.products.push(product); });
      res.status(201).json({ product });
    } catch (e) { next(e); }
  });

  api.put('/products/:id', async (req, res, next) => {
    try {
      const db = store.get();
      const before = db.products.find((p) => p.id === req.params.id);
      if (!before) return res.status(404).json({ error: 'Коллекция не найдена' });
      const clean = cleanProduct({ ...before, ...(req.body || {}) }, db, before.id);
      const product = { ...before, ...clean };
      await store.update((d) => {
        const i = d.products.findIndex((p) => p.id === before.id);
        d.products[i] = product;
      });
      (before.images || []).filter((u) => !product.images.includes(u)).forEach((u) => images.removeIfUnused(u, store.get()));
      res.json({ product });
    } catch (e) { next(e); }
  });

  /** Быстрое обновление цен и наличия сразу по многим коллекциям. */
  api.patch('/products', async (req, res, next) => {
    try {
      const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
      const db = store.get();
      const byId = new Map(db.products.map((p) => [p.id, p]));
      const changed = [];
      for (const r of rows) {
        const before = byId.get(r && r.id);
        if (!before) continue;
        const merged = { ...before };
        for (const k of ['price', 'stock', 'readyIn', 'leadTime', 'arrival', 'hidden']) if (k in r) merged[k] = r[k];
        changed.push({ ...before, ...cleanProduct(merged, db, before.id) });
      }
      await store.update((d) => {
        changed.forEach((p) => {
          const i = d.products.findIndex((x) => x.id === p.id);
          if (i >= 0) d.products[i] = p;
        });
      });
      res.json({ updated: changed.length });
    } catch (e) { next(e); }
  });

  api.post('/products/:id/duplicate', async (req, res, next) => {
    try {
      const db = store.get();
      const src = db.products.find((p) => p.id === req.params.id);
      if (!src) return res.status(404).json({ error: 'Коллекция не найдена' });
      const clean = cleanProduct({ ...src, name: `${src.name} (копия)`, slug: '', hidden: true }, db, null);
      const product = { id: crypto.randomBytes(6).toString('hex'), ...clean, order: (src.order || 0) + 1 };
      await store.update((d) => { d.products.push(product); });
      res.status(201).json({ product });
    } catch (e) { next(e); }
  });

  api.delete('/products/:id', async (req, res, next) => {
    try {
      const before = store.get().products.find((p) => p.id === req.params.id);
      if (!before) return res.status(404).json({ error: 'Коллекция не найдена' });
      await store.update((d) => { d.products = d.products.filter((p) => p.id !== before.id); });
      (before.images || []).forEach((u) => images.removeIfUnused(u, store.get()));
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  api.post('/upload', images.upload.array('files', 12), async (req, res, next) => {
    try {
      const files = req.files || [];
      if (!files.length) return res.status(400).json({ error: 'Файл не выбран' });
      const urls = [];
      for (const f of files) urls.push(await images.saveImage(f.buffer));
      res.json({ urls });
    } catch (e) { next(e); }
  });

  api.post('/password', async (req, res, next) => {
    try {
      const { current, next: nextPw } = req.body || {};
      if (!auth.verifyPassword(current || '', store.get().admin.password)) {
        return res.status(400).json({ error: 'Текущий пароль указан неверно' });
      }
      if (String(nextPw || '').length < 8) return res.status(400).json({ error: 'Новый пароль — не короче 8 символов' });
      const rec = auth.hashPassword(nextPw);
      await store.update((d) => { d.admin.password = rec; });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  api.get('/backup', (req, res) => {
    const { settings, series, products } = store.get();
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="vistone-backup-${stamp}.json"`);
    res.json({ version: 1, settings, series, products });
  });

  app.use('/api/admin', api);

  app.use((req, res) => res.status(404).type('html').send(pages.notFound(view(req))));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Файл больше 15 МБ' : (status < 500 ? err.message : 'Ошибка сервера');
    if (status >= 500) console.error(err);
    if (req.path.startsWith('/api/')) return res.status(status).json({ error: message });
    res.status(status).type('text/plain').send(message);
  });

  return app;
}

/**
 * Пароль админки. Если задан ADMIN_PASSWORD — он используется при первом запуске.
 * Если нет — генерируется случайный и печатается в лог один раз.
 * Потом пароль меняется в самой админке, переменная больше не нужна.
 */
function ensurePassword() {
  const db = store.get();
  if (db.admin && db.admin.password) return;
  let pw = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!pw) {
    pw = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }
  const rec = auth.hashPassword(pw);
  store.update((d) => { d.admin.password = rec; });
  if (generated) {
    console.log('\n==============================================');
    console.log(' Пароль админки (/admin): ' + pw);
    console.log(' Сохраните его и смените в админке → Настройки.');
    console.log('==============================================\n');
  }
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`VISTONE: http://localhost:${port}  (админка: /admin)`));
}

module.exports = { createApp };
