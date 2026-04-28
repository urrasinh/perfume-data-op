import {
  guard, htmlResponse, notFound, sanitizeSku, esc,
} from './_shared/security.mjs';
import { loadComentarios } from './_shared/data.mjs';

const MESES = ['enero','febrero','marzo','abril','mayo','junio',
               'julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatearFecha(fechaStr) {
  if (!fechaStr) return '';
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return fechaStr;
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const PALETTE = [
  '#3b82f6','#8b5cf6','#ec4899','#f59e0b',
  '#10b981','#06b6d4','#ef4444','#6366f1',
  '#14b8a6','#f97316',
];
function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function extraerComentarios(entry) {
  const out = [];
  for (const key of Object.keys(entry)) {
    const m = key.match(/^comentario(?:\.(\d+))?$/);
    if (!m) continue;
    const suffix = m[1] ? `.${m[1]}` : '';
    const texto = entry[`comentario${suffix}`];
    const usuario = entry[`usuario${suffix}`];
    const fecha = entry[`fecha${suffix}`];
    if (texto && usuario) {
      out.push({
        texto: String(texto).trim(),
        usuario: String(usuario).trim(),
        fecha: fecha ? String(fecha).trim() : '',
        orden: m[1] ? parseInt(m[1], 10) : 0,
      });
    }
  }
  out.sort((a, b) => a.orden - b.orden);
  return out;
}

function renderCard(c, i, initiallyHidden) {
  const inicial = esc(c.usuario.charAt(0) || '?');
  const color = colorFor(c.usuario);
  const hidden = initiallyHidden ? ' hidden' : '';
  const delay = initiallyHidden ? 0 : i * 80;
  return (
    `<article class="comentario-card${hidden}" style="animation-delay:${delay}ms">` +
      `<header class="comentario-top">` +
        `<div class="comentario-avatar" style="background-color:${color}">${inicial}</div>` +
        `<div class="comentario-meta">` +
          `<span class="comentario-usuario">@${esc(c.usuario)}</span>` +
          `<time class="comentario-fecha" datetime="${esc(c.fecha)}">${esc(formatearFecha(c.fecha))}</time>` +
        `</div>` +
      `</header>` +
      `<p class="comentario-texto">${esc(c.texto)}</p>` +
    `</article>`
  );
}

const VISIBLE_INICIAL = 3;

export default async (request) => {
  const url = new URL(request.url);
  const sku = sanitizeSku(url.searchParams.get('sku'));
  if (!sku) return notFound();

  const g = await guard(request, sku);
  if (g.response) return g.response;

  const data = await loadComentarios();
  const entry = data.find((e) => e.sku === sku);
  if (!entry) return notFound();

  const comentarios = extraerComentarios(entry);
  if (comentarios.length === 0) return notFound();

  const label = comentarios.length === 1 ? 'opinión' : 'opiniones';

  const cards = comentarios
    .map((c, i) => renderCard(c, i, i >= VISIBLE_INICIAL))
    .join('');

  const toggle = comentarios.length > VISIBLE_INICIAL
    ? `<button type="button" id="comentarios-toggle" class="comentarios-toggle">` +
        `<span class="toggle-text">Ver más opiniones</span>` +
        `<svg class="toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>` +
      `</button>`
    : '';

  const html =
    `<div class="comentarios-header">` +
      `<h3 class="comentarios-title">Opiniones de la comunidad</h3>` +
      `<span class="comentarios-count">${comentarios.length} ${label}</span>` +
    `</div>` +
    `<div id="comentarios-list">${cards}</div>` +
    toggle;

  return htmlResponse(html, request);
};

export const config = { path: '/api/comentarios' };
