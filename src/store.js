'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PREV_FILE = path.join(DATA_DIR, 'db.prev.json');
const SEED_DIR = path.join(ROOT, 'seed');

let db = null;
let chain = Promise.resolve();

/**
 * Первый запуск: копируем стартовый каталог и фотографии плит из seed/.
 * Дальше все изменения живут только в DATA_DIR — seed больше не читается.
 */
function init() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seed = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'catalog.json'), 'utf8'));
    const imgDir = path.join(SEED_DIR, 'images');
    for (const f of fs.readdirSync(imgDir)) {
      const dst = path.join(UPLOADS_DIR, f);
      if (!fs.existsSync(dst)) fs.copyFileSync(path.join(imgDir, f), dst);
    }
    seed.admin = {};
    writeSync(seed);
  }
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!db.admin) db.admin = {};
  return db;
}

function writeSync(data) {
  const tmp = DB_FILE + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, PREV_FILE);
  fs.renameSync(tmp, DB_FILE);
}

function get() {
  return db;
}

/**
 * Изменение данных: мутация применяется к копии, пишется на диск атомарно
 * (временный файл + rename), и только после записи становится текущей.
 * Записи выстраиваются в очередь, поэтому параллельные сохранения не теряются.
 */
function update(mutator) {
  const run = chain.then(() => {
    const next = JSON.parse(JSON.stringify(db));
    const result = mutator(next);
    writeSync(next);
    db = next;
    return result;
  });
  chain = run.catch(() => {});
  return run;
}

/** Публичные данные: без скрытых позиций и без служебного раздела admin. */
function publicView() {
  const { settings, series } = db;
  const products = db.products
    .filter((p) => !p.hidden)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return { settings, series: [...series].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), products };
}

module.exports = { init, get, update, publicView, DATA_DIR, UPLOADS_DIR, DB_FILE };
