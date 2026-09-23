'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOADS_DIR } = require('./store');

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  // sharp не установился — фото сохраняются как есть, без уменьшения
}

const MAX_BYTES = 15 * 1024 * 1024;

/** Проверяем сам файл, а не то, что про него заявил браузер. */
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 12 },
});

/**
 * Сохраняет загруженное фото в uploads/. С sharp — поворачивает по EXIF,
 * уменьшает до 2000 px по длинной стороне и сжимает в JPEG.
 * Возвращает публичный путь вида /uploads/<имя>.jpg.
 */
async function saveImage(buf) {
  const kind = sniff(buf);
  if (!kind) {
    const err = new Error('Нужен файл JPG, PNG или WebP');
    err.status = 400;
    throw err;
  }
  const id = crypto.randomBytes(8).toString('hex');
  let out = buf;
  let ext = kind;
  if (sharp) {
    out = await sharp(buf)
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    ext = 'jpg';
  }
  const name = `${id}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), out);
  return `/uploads/${name}`;
}

/** Удаляет файл, если на него больше никто не ссылается. */
function removeIfUnused(url, db) {
  if (!/^\/uploads\/[a-z0-9._-]+$/i.test(url || '')) return;
  const used =
    db.products.some((p) => (p.images || []).includes(url)) ||
    db.series.some((s) => s.image === url) ||
    db.settings.hero?.image === url;
  if (used) return;
  const file = path.join(UPLOADS_DIR, path.basename(url));
  fs.rm(file, { force: true }, () => {});
}

module.exports = { upload, saveImage, removeIfUnused, hasSharp: !!sharp };
