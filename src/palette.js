'use strict';

/*
 * Цвет плиты по главному фото — для подбора сочетаний.
 * tone   — основной тон (медиана по фото, прожилки и блики на него не влияют);
 * vein   — цвет рисунка: прожилок, вкраплений, если они заметны;
 * spread — насколько контрастен рисунок.
 * Считается при сохранении коллекции и при запуске сайта для коллекций, где ещё не посчитан.
 */

const path = require('path');
const { UPLOADS_DIR } = require('./store');
const { rgbToLab, labToHex, deltaE } = require('../public/js/match');

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  // без sharp тон берётся из названия цвета коллекции
}

// Меняется, если поменяется способ расчёта, — тогда цвета пересчитаются при запуске.
const VERSION = 1;

function median(list) {
  const s = [...list].sort((x, y) => x - y);
  return s[s.length >> 1];
}

async function analyze(url) {
  if (!sharp || !/^\/uploads\/[a-z0-9._-]+$/i.test(url || '')) return null;
  try {
    const { data, info } = await sharp(path.join(UPLOADS_DIR, path.basename(url)))
      .rotate()
      .resize(160, 160, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Края (5 %) не учитываем — там бывают рамки и тени от съёмки.
    const mx = Math.floor(info.width * 0.05), my = Math.floor(info.height * 0.05);
    const px = [];
    for (let y = my; y < info.height - my; y++) {
      for (let x = mx; x < info.width - mx; x++) {
        const i = (y * info.width + x) * info.channels;
        px.push(rgbToLab(data[i], data[i + 1], data[i + 2]));
      }
    }
    if (!px.length) return null;
    const base = [0, 1, 2].map((k) => median(px.map((p) => p[k])));
    const meanL = px.reduce((s, p) => s + p[0], 0) / px.length;
    const spread = Math.sqrt(px.reduce((s, p) => s + (p[0] - meanL) ** 2, 0) / px.length);
    const far = px.filter((p) => deltaE(p, base) > 15);
    const share = far.length / px.length;
    const vein = share >= 0.03 && share <= 0.45 ? [0, 1, 2].map((k) => median(far.map((p) => p[k]))) : null;
    return {
      v: VERSION,
      image: url,
      tone: labToHex(base[0], base[1], base[2]),
      vein: vein ? labToHex(vein[0], vein[1], vein[2]) : '',
      spread: Math.round(spread * 10) / 10,
    };
  } catch {
    return null;
  }
}

function stale(p) {
  const img = p.images && p.images[0];
  if (!img) return !!p.palette;
  return !p.palette || p.palette.image !== img || p.palette.v !== VERSION;
}

/** Коллекция с актуальным цветом по главному фото. */
async function ensure(product) {
  if (!stale(product)) return product;
  const img = product.images && product.images[0];
  const palette = img ? await analyze(img) : null;
  const out = { ...product };
  if (palette) out.palette = palette;
  else delete out.palette;
  return out;
}

/** При запуске: досчитать цвета коллекций, у которых их ещё нет или сменилось главное фото. */
async function backfill(store) {
  if (!sharp) return 0;
  const todo = store.get().products.filter(stale);
  if (!todo.length) return 0;
  const found = new Map();
  for (const p of todo) found.set(p.id, await analyze(p.images && p.images[0]));
  await store.update((db) => {
    db.products.forEach((p) => {
      if (!found.has(p.id)) return;
      const r = found.get(p.id);
      const img = p.images && p.images[0];
      if (r && r.image === img) p.palette = r;
      else if (!img) delete p.palette;
    });
  });
  return [...found.values()].filter(Boolean).length;
}

module.exports = { analyze, ensure, backfill, hasSharp: !!sharp };
