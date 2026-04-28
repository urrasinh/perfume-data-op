// Utilidades compartidas: validación de Origin/Referer, rate limit por IP,
// verificación de token HMAC generado en Liquid, escape HTML.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const TOKEN_SALT = process.env.TOKEN_SALT || '';
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MIN || '120', 10);

export function originAllowed(request) {
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  if (ALLOWED_ORIGINS.length === 0) return true; // dev
  const matchesOrigin = ALLOWED_ORIGINS.some((o) => origin === o);
  const matchesReferer = ALLOWED_ORIGINS.some((o) => referer.startsWith(o + '/'));
  return matchesOrigin || matchesReferer;
}

export function corsHeaders(request) {
  const origin = request.headers.get('origin') || '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Token rotativo: sha256(sku + hourBucket + salt). Se puede calcular
// en Liquid con `| hmac_sha256`. No es un secreto (TOKEN_SALT es público),
// sólo fricción extra contra scrapers que no ejecuten el paso.
export function expectedToken(sku, hourBucket) {
  return createHmac('sha256', TOKEN_SALT)
    .update(`${sku}:${hourBucket}`)
    .digest('hex');
}

export function tokenValid(sku, providedToken) {
  if (!TOKEN_SALT) return true;
  if (!providedToken || typeof providedToken !== 'string') return false;
  const now = Math.floor(Date.now() / 3_600_000);
  for (const bucket of [now, now - 1]) {
    const expected = expectedToken(sku, bucket);
    try {
      if (expected.length === providedToken.length &&
          timingSafeEqual(Buffer.from(expected), Buffer.from(providedToken))) {
        return true;
      }
    } catch {}
  }
  return false;
}

export async function rateLimited(ip) {
  if (!RATE_LIMIT || RATE_LIMIT <= 0) return false;
  try {
    const store = getStore('rate-limit');
    const key = `${ip}:${Math.floor(Date.now() / 60_000)}`;
    const current = parseInt((await store.get(key)) || '0', 10);
    if (current >= RATE_LIMIT) return true;
    await store.set(key, String(current + 1), {
      metadata: { ttl: 120 },
    });
    return false;
  } catch {
    return false; // fallo del store no debe tirar el servicio
  }
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function clientIp(request) {
  return (
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

export function forbidden(msg = 'Forbidden') {
  return new Response(msg, { status: 403, headers: { 'Content-Type': 'text/plain' } });
}

export function notFound() {
  return new Response('', { status: 204 });
}

export function tooMany() {
  return new Response('Too Many Requests', {
    status: 429,
    headers: { 'Content-Type': 'text/plain', 'Retry-After': '60' },
  });
}

export function htmlResponse(html, request) {
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ...corsHeaders(request),
    },
  });
}

export function preflight(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function sanitizeSku(raw) {
  if (!raw) return null;
  const sku = String(raw).trim().toUpperCase();
  if (!/^[A-Z0-9._-]{1,64}$/.test(sku)) return null;
  return sku;
}

export async function guard(request, sku) {
  if (request.method === 'OPTIONS') return { response: preflight(request) };
  if (request.method !== 'GET') return { response: forbidden('Method not allowed') };
  if (!originAllowed(request)) return { response: forbidden('Origin not allowed') };

  const ip = clientIp(request);
  if (await rateLimited(ip)) return { response: tooMany() };

  const token = new URL(request.url).searchParams.get('t');
  if (!tokenValid(sku, token)) return { response: forbidden('Invalid token') };

  return { ip };
}
