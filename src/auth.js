'use strict';

const crypto = require('crypto');

const COOKIE = 'vs_admin';
const SESSION_TTL = 1000 * 60 * 60 * 12; // 12 часов
const sessions = new Map();
const attempts = new Map();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, rec) {
  if (!rec || !rec.salt || !rec.hash) return false;
  const got = crypto.scryptSync(String(password), rec.salt, 64);
  const want = Buffer.from(rec.hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

function parseCookies(header) {
  const out = {};
  String(header || '')
    .split(';')
    .forEach((part) => {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
  return out;
}

function isHttps(req) {
  return req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function createSession(res, req) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL);
  const parts = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_TTL / 1000)}`,
  ];
  if (isHttps(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

function isAuthed(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

/** Не больше 10 неудачных попыток входа за 15 минут с одного адреса. */
function tooManyAttempts(ip) {
  const rec = attempts.get(ip);
  return !!(rec && rec.count >= 10 && rec.until > Date.now());
}
function noteFailure(ip) {
  const rec = attempts.get(ip);
  if (!rec || rec.until < Date.now()) attempts.set(ip, { count: 1, until: Date.now() + 15 * 60 * 1000 });
  else rec.count += 1;
}
function clearFailures(ip) {
  attempts.delete(ip);
}

/**
 * Защита API админки: нужна сессия, а изменяющие запросы должны идти
 * с заголовком X-Requested-With — простая защита от подделки запросов с чужих сайтов.
 */
function requireAdmin(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Нужно войти в админку' });
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'vistone-admin') {
    return res.status(403).json({ error: 'Запрос отклонён' });
  }
  next();
}

module.exports = {
  hashPassword, verifyPassword, createSession, destroySession, isAuthed,
  requireAdmin, tooManyAttempts, noteFailure, clearFailures,
};
