import {
  guard, htmlResponse, notFound, sanitizeSku, esc,
} from './_shared/security.mjs';
import { loadAromas } from './_shared/data.mjs';

function renderRow(accord) {
  const nombre = esc(accord.nombre);
  const pct = Math.max(0, Math.min(100, Number(accord.porcentaje) || 0));
  const color = /^#[0-9a-fA-F]{3,8}$/.test(accord.color || '') ? accord.color : '#cccccc';
  return (
    `<div class="aroma-row">` +
      `<div class="aroma-label">${nombre}</div>` +
      `<div class="aroma-bar-track">` +
        `<div class="aroma-bar-fill" data-width="${pct}%" style="background-color:${color}"></div>` +
      `</div>` +
    `</div>`
  );
}

export default async (request) => {
  const url = new URL(request.url);
  const sku = sanitizeSku(url.searchParams.get('sku'));
  if (!sku) return notFound();

  const g = await guard(request, sku);
  if (g.response) return g.response;

  const data = await loadAromas();
  const accords = data[sku];
  if (!Array.isArray(accords) || accords.length === 0) return notFound();

  const html =
    `<h3 class="aromas-title">Aromas Principales</h3>` +
    `<div id="aromas-bars">${accords.map(renderRow).join('')}</div>`;

  return htmlResponse(html, request);
};

export const config = { path: '/api/aromas' };
