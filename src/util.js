'use strict';

const nf = new Intl.NumberFormat('ru-RU');

/** Экранирование для вставки в HTML — всё, что приходит из админки, проходит через него. */
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(v) {
  return nf.format(Math.round(v)) + ' ₸';
}

function num(v, digits = 0) {
  return Number(v).toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** «1200×3600» → площадь плиты в м². */
function sizeArea(size) {
  const m = String(size).match(/(\d+(?:[.,]\d+)?)\s*[×xх*]\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const a = parseFloat(m[1].replace(',', '.'));
  const b = parseFloat(m[2].replace(',', '.'));
  return (a * b) / 1e6;
}

function plural(n, forms) {
  const m100 = n % 100;
  const m10 = n % 10;
  if (m100 > 10 && m100 < 20) return forms[2];
  if (m10 === 1) return forms[0];
  if (m10 > 1 && m10 < 5) return forms[1];
  return forms[2];
}

function slugify(s) {
  const map = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  return String(s || '')
    .toLowerCase()
    .split('')
    .map((c) => (map[c] !== undefined ? map[c] : c))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Только цифры — из них собирается ссылка wa.me. */
function digits(v) {
  return String(v || '').replace(/\D/g, '');
}

module.exports = { esc, money, num, nf, sizeArea, plural, slugify, digits };
