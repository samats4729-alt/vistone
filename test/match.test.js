'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/js/match');

const m = (name, tone, type, finish, extra) => ({ id: name, slug: name, name, tone, type, finish, ...extra });
const whiteMarble = m('Белый мрамор', '#f8f8f8', 'Мрамор', 'Формованная');
const blackMarble = m('Чёрный мрамор', '#3b3e3d', 'Мрамор', 'Формованная');
const terrazzo = m('Терраццо', '#838385', 'Терраццо', 'Формованная');
const darkWood = m('Тёмное дерево', '#4e4339', 'Дерево', 'Тонкая матовая');
const oakA = m('Дуб A', '#9a8669', 'Дерево', 'Тонкая матовая');
const oakB = m('Дуб B', '#a08a62', 'Дерево', 'Тонкая матовая');
const beige = m('Бежевый камень', '#d3c19c', 'Камень', 'Формованная');
const coolGrey = m('Холодный серый', '#b9c4d4', 'Песчаник', 'Формованная');
const orange = m('Оранжевый', '#f0a05a', 'Однотонный', 'Гладкая');
const green = m('Зелёный', '#c8e6a0', 'Однотонный', 'Гладкая');
const sand = m('Песочный однотон', '#d9d5cf', 'Однотонный', 'Гладкая');

test('цвет: перевод в Lab и обратно', () => {
  for (const hex of ['#ffffff', '#000000', '#3b3e3d', '#d3c19c', '#f0a05a']) {
    const [L, a, b] = M.hexToLab(hex);
    assert.equal(M.labToHex(L, a, b), hex);
  }
  assert.ok(Math.abs(M.hexToLab('#ffffff')[0] - 100) < 0.1);
});

test('свойства материала берутся из типа и отделки', () => {
  assert.equal(M.prepare(whiteMarble).level, 2);
  assert.equal(M.prepare(orange).level, 0);
  assert.equal(M.prepare(darkWood).family, 'wood');
  assert.equal(M.prepare(whiteMarble).temp, 'neutral');
  assert.equal(M.prepare(beige).temp, 'warm');
  assert.equal(M.prepare(coolGrey).temp, 'cool');
  // заданный вручную рисунок важнее типа
  assert.equal(M.prepare({ ...beige, pattern: 'busy' }).level, 2);
});

test('классические пары — «отлично»', () => {
  assert.equal(M.pair(whiteMarble, darkWood).verdict.key, 'great');
  assert.equal(M.pair(sand, blackMarble).verdict.key, 'great');
});

test('два выразительных рисунка — не советуем, с объяснением', () => {
  const r = M.pair(blackMarble, terrazzo);
  assert.equal(r.verdict.key, 'poor');
  assert.equal(r.notes[0].kind, 'bad');
  assert.match(r.notes[0].text, /Два выразительных рисунка/);
});

test('два разных дерева близкого тона — не советуем', () => {
  const r = M.pair(oakA, oakB);
  assert.equal(r.verdict.key, 'poor');
  assert.ok(r.notes.some((n) => /Два разных дерева/.test(n.text)));
});

test('тёплый и холодный подтон спорят', () => {
  const r = M.pair(beige, coolGrey);
  assert.ok(r.score < 65, `оценка ${r.score}`);
  assert.ok(r.notes.some((n) => /подтон/i.test(n.text) && (n.kind === 'bad' || n.kind === 'warn')));
});

test('два ярких цвета — перегруз, один яркий — не выше «хорошо»', () => {
  assert.equal(M.pair(orange, green).verdict.key, 'poor');
  const one = M.pair(orange, sand);
  assert.ok(one.score <= 79 && one.score >= 65, `оценка ${one.score}`);
});

test('подборка из трёх: роли 60/30/10, выразительный материал — акцент', () => {
  const g = M.group([whiteMarble, darkWood, sand]);
  assert.equal(g.roles.length, 3);
  assert.deepEqual(g.roles.map((r) => r.share), [60, 30, 10]);
  assert.equal(g.roles[2].item.name, 'Белый мрамор');
  assert.equal(g.pairs.length, 3);
});

test('если в подборке есть спорная пара — подборка не может быть хорошей', () => {
  const g = M.group([blackMarble, terrazzo, sand]);
  assert.equal(g.verdict.key, 'poor');
});

test('подсказки: без уже выбранного, лучшие сверху, не больше двух из одной серии', () => {
  const all = [whiteMarble, blackMarble, terrazzo, darkWood, oakA, oakB, beige, coolGrey, orange, green, sand]
    .map((x, i) => ({ ...x, seriesId: i % 2 ? 's1' : 's2' }));
  const list = M.suggest([all[0]], all, { limit: 5, perSeries: 2 });
  assert.ok(list.length <= 4);
  assert.ok(!list.some((x) => x.item.id === all[0].id));
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].score >= list[i].score);
  // к спорной подборке остальные материалы оцениваются по своим парам, а не все «не советуем»
  const rank = M.rank([blackMarble, terrazzo], [darkWood, sand]);
  assert.notEqual(rank[sand.id].verdict.key, 'poor');
});
