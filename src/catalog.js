'use strict';

const { num, sizeArea } = require('./util');

/** Общие характеристики из настроек подставляются, если у коллекции поле пустое. */
function effective(p, settings) {
  const d = settings.defaults || {};
  const own = new Set((p.specs || []).map((s) => s.name.toLowerCase()));
  return {
    ...p,
    country: p.country || d.country || '',
    factory: p.factory || d.factory || '',
    composition: p.composition || d.composition || '',
    specs: [...(p.specs || []), ...(d.specs || []).filter((s) => !own.has(s.name.toLowerCase()))],
  };
}

/**
 * Наличие по ТЗ: есть ли сейчас → сколько м² → когда можно получить → срок поставки.
 * key: in — в наличии, low — остаток меньше порога, order — нет на складе, unknown — не заполнено.
 */
function availability(p, settings) {
  const low = (settings.calc && settings.calc.lowStock) || 30;
  if (p.stock === null || p.stock === undefined) {
    return { key: 'unknown', label: 'Наличие уточняйте', short: 'Уточняйте наличие' };
  }
  if (p.stock <= 0) {
    return {
      key: 'order',
      label: p.leadTime ? `Под заказ · ${p.leadTime}` : 'Под заказ',
      short: 'Под заказ',
    };
  }
  if (p.stock < low) {
    return { key: 'low', label: `Осталось ${num(p.stock)} м²`, short: `Осталось ${num(p.stock)} м²` };
  }
  return { key: 'in', label: `В наличии ${num(p.stock)} м²`, short: `В наличии ${num(p.stock)} м²` };
}

function seriesOf(p, series) {
  return series.find((s) => s.id === p.seriesId) || null;
}

function uniq(list) {
  return [...new Set(list.filter((v) => v !== '' && v !== null && v !== undefined))];
}

/** Значения для фильтров каталога — строятся из самих данных. */
function facets(products, series) {
  const prices = products.map((p) => p.price).filter((v) => typeof v === 'number' && v > 0);
  return {
    series: series.filter((s) => products.some((p) => p.seriesId === s.id)),
    types: uniq(products.map((p) => p.type)).sort((a, b) => a.localeCompare(b, 'ru')),
    colors: uniq(products.map((p) => p.color)).sort((a, b) => a.localeCompare(b, 'ru')),
    finishes: uniq(products.map((p) => p.finish)).sort((a, b) => a.localeCompare(b, 'ru')),
    sizes: uniq(products.flatMap((p) => p.sizes || [])).sort((a, b) => (sizeArea(b) || 0) - (sizeArea(a) || 0)),
    thickness: uniq(products.flatMap((p) => p.thickness || [])).sort((a, b) => a - b),
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
  };
}

/** Цвет образца в фильтре — средний тон первой коллекции этого цвета. */
const COLOR_SWATCH = {
  'Белый': '#F3F1EC', 'Бежевый': '#D8C8A8', 'Серый': '#9A9D9F', 'Чёрный': '#1E1F21',
  'Коричневый': '#6B4A33', 'Зелёный': '#5E7A4F', 'Оранжевый': '#E08A3C', 'Терракотовый': '#B0613F',
  'Голубой': '#8FAFC4', 'Синий': '#34506E', 'Жёлтый': '#E0C25A', 'Красный': '#9E3B32',
};

function sizesText(p) {
  return (p.sizes || []).map((s) => s.replace('×', ' × ')).join(', ');
}
function thicknessText(p) {
  const t = p.thickness || [];
  if (!t.length) return '';
  if (t.length === 1) return `${num(t[0])} мм`;
  return `${num(t[0])}–${num(t[t.length - 1])} мм`;
}

module.exports = { effective, availability, seriesOf, facets, COLOR_SWATCH, sizesText, thicknessText };
