import {
  guard, htmlResponse, notFound, sanitizeSku, esc,
} from './_shared/security.mjs';
import { loadPiramides } from './_shared/data.mjs';

function renderNotas(titulo, notas) {
  if (!Array.isArray(notas) || notas.length === 0) return '';
  const items = notas.map((nota) => {
    const nombre = esc(nota.nombre || '');
    let url = String(nota.url || '');
    if (!/^https:\/\//i.test(url)) url = '';
    const img = url
      ? `<img src="${esc(url)}" alt="Nota de ${nombre}" loading="lazy" onerror="this.style.display='none'">`
      : '';
    return (
      `<div class="nota-item">` +
        `<div class="nota-img-wrapper">${img}</div>` +
        `<div class="nota-nombre">${nombre}</div>` +
      `</div>`
    );
  }).join('');
  return (
    `<div class="piramide-seccion">` +
      `<h4>${esc(titulo)}</h4>` +
      `<div class="notas-container">${items}</div>` +
    `</div>`
  );
}

export default async (request) => {
  const url = new URL(request.url);
  const sku = sanitizeSku(url.searchParams.get('sku'));
  if (!sku) return notFound();

  const g = await guard(request, sku);
  if (g.response) return g.response;

  const data = await loadPiramides();
  const piramide = data[sku];
  if (!piramide) return notFound();

  const html =
    renderNotas('Notas de Salida',   piramide.salida)  +
    renderNotas('Notas de Corazón',  piramide.corazon) +
    renderNotas('Notas de Fondo',    piramide.base)    +
    renderNotas('Notas Principales', piramide.todas);

  if (!html.trim()) return notFound();

  return htmlResponse(html, request);
};

export const config = { path: '/api/notas' };
