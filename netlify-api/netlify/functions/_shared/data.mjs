// Carga perezosa y memoizada de los JSON empaquetados con la función.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// En Netlify Functions, included_files se extraen bajo el cwd de la función.
const dataDir = resolve(process.cwd(), 'data');

const cache = new Map();

async function loadJson(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const raw = await readFile(resolve(dataDir, filename), 'utf8');
  const parsed = JSON.parse(raw);
  cache.set(filename, parsed);
  return parsed;
}

export const loadAromas      = () => loadJson('aromas.json');
export const loadPiramides   = () => loadJson('piramides.json');
export const loadComentarios = () => loadJson('comentarios.json');
