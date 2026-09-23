'use strict';

const { slugify } = require('./util');

function str(v, max = 200) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}
function text(v, max = 4000) {
  return String(v == null ? '' : v).replace(/\r\n/g, '\n').trim().slice(0, max);
}
function numOrNull(v, max = 1e10) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, max);
}
function int(v, def = 0, min = 0, max = 1e6) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}
function strList(v, maxItems = 30, maxLen = 200) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
}
function points(v, maxItems = 12) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => ({ title: str(x && x.title, 120), text: text(x && x.text, 400) }))
    .filter((x) => x.title)
    .slice(0, maxItems);
}
function specs(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => ({ name: str(x && x.name, 80), value: str(x && x.value, 200) }))
    .filter((x) => x.name && x.value)
    .slice(0, 40);
}
function imageUrl(v) {
  const s = String(v || '');
  return /^\/uploads\/[a-z0-9._-]+$/i.test(s) ? s : '';
}
/** «1200 x 3600», «1200*3600 мм» → «1200×3600». */
function sizes(v) {
  return strList(v, 12, 40)
    .map((s) => {
      const m = s.match(/(\d{2,5})\s*[×xх*]\s*(\d{2,5})/i);
      return m ? `${m[1]}×${m[2]}` : '';
    })
    .filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i);
}
function thickness(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => numOrNull(x, 100))
    .filter((x) => x !== null && x > 0)
    .filter((x, i, a) => a.indexOf(x) === i)
    .sort((a, b) => a - b)
    .slice(0, 10);
}

function cleanProduct(input, db, existingId) {
  const name = str(input.name, 120);
  if (!name) {
    const e = new Error('Укажите название коллекции');
    e.status = 400;
    throw e;
  }
  let slug = slugify(input.slug || name) || 'kollekciya';
  const taken = (s) => db.products.some((p) => p.slug === s && p.id !== existingId);
  if (taken(slug)) {
    let i = 2;
    while (taken(`${slug}-${i}`)) i += 1;
    slug = `${slug}-${i}`;
  }
  const seriesId = db.series.some((s) => s.id === input.seriesId) ? input.seriesId : '';
  return {
    slug,
    name,
    article: str(input.article, 60),
    seriesId,
    type: str(input.type, 60),
    color: str(input.color, 60),
    finish: str(input.finish, 80),
    body: str(input.body, 80),
    sizes: sizes(input.sizes),
    thickness: thickness(input.thickness),
    composition: text(input.composition, 600),
    country: str(input.country, 80),
    factory: str(input.factory, 120),
    specs: specs(input.specs),
    description: text(input.description, 4000),
    usage: text(input.usage, 1000),
    price: numOrNull(input.price),
    stock: numOrNull(input.stock, 1e7),
    readyIn: str(input.readyIn, 80),
    leadTime: str(input.leadTime, 80),
    arrival: str(input.arrival, 120),
    images: (Array.isArray(input.images) ? input.images : []).map(imageUrl).filter(Boolean).slice(0, 12),
    featured: !!input.featured,
    hidden: !!input.hidden,
    order: int(input.order, 0, 0, 100000),
  };
}

function cleanSeries(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list
    .map((s, i) => {
      const name = str(s && s.name, 80);
      if (!name) return null;
      let id = str(s.id, 60) || slugify(name) || `seriya-${i + 1}`;
      id = id.replace(/[^a-z0-9-]/gi, '').toLowerCase() || `seriya-${i + 1}`;
      while (seen.has(id)) id += '-2';
      seen.add(id);
      return {
        id,
        name,
        nameEn: str(s.nameEn, 80),
        description: text(s.description, 600),
        image: imageUrl(s.image),
        order: i,
      };
    })
    .filter(Boolean)
    .slice(0, 50);
}

function cleanSettings(s) {
  s = s || {};
  const c = s.contacts || {};
  const calc = s.calc || {};
  return {
    siteName: str(s.siteName, 60) || 'VISTONE',
    tagline: str(s.tagline, 120),
    city: str(s.city, 60),
    seo: { title: str(s.seo && s.seo.title, 120), description: str(s.seo && s.seo.description, 300) },
    hero: {
      title: str(s.hero && s.hero.title, 160),
      subtitle: text(s.hero && s.hero.subtitle, 400),
      image: imageUrl(s.hero && s.hero.image),
    },
    about: {
      title: str(s.about && s.about.title, 120),
      text: text(s.about && s.about.text, 1200),
      points: points(s.about && s.about.points, 8),
    },
    applications: strList(s.applications, 16, 80),
    designers: {
      title: str(s.designers && s.designers.title, 120),
      text: text(s.designers && s.designers.text, 800),
      points: points(s.designers && s.designers.points, 16),
    },
    process: {
      title: str(s.process && s.process.title, 120),
      steps: points(s.process && s.process.steps, 12),
    },
    developers: {
      title: str(s.developers && s.developers.title, 120),
      text: text(s.developers && s.developers.text, 1200),
      audiences: strList(s.developers && s.developers.audiences, 10, 80),
      points: strList(s.developers && s.developers.points, 16, 200),
    },
    contacts: {
      managers: (Array.isArray(c.managers) ? c.managers : [])
        .map((m) => ({
          name: str(m && m.name, 60),
          role: str(m && m.role, 120),
          phone: str(m && m.phone, 40),
          whatsapp: String((m && m.whatsapp) || '').replace(/\D/g, '').slice(0, 15),
        }))
        .filter((m) => m.name)
        .slice(0, 8),
      showroom: str(c.showroom, 160),
      hours: str(c.hours, 120),
      instagram: str(c.instagram, 60).replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, ''),
      mapUrl: /^https:\/\//.test(String(c.mapUrl || '')) ? str(c.mapUrl, 400) : '',
    },
    defaults: {
      country: str(s.defaults && s.defaults.country, 80),
      factory: str(s.defaults && s.defaults.factory, 120),
      composition: text(s.defaults && s.defaults.composition, 600),
      specs: specs(s.defaults && s.defaults.specs),
    },
    calc: {
      designerBonus: Math.min(100, numOrNull(calc.designerBonus) ?? 10),
      defaultWaste: Math.min(50, numOrNull(calc.defaultWaste) ?? 10),
      lowStock: numOrNull(calc.lowStock) ?? 30,
    },
  };
}

module.exports = { cleanProduct, cleanSeries, cleanSettings };
