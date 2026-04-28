#!/usr/bin/env node
// Convierte los archivos `window.xxxData = {...}` a JSON puro en /data.
// Uso: npm run convert

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const outDir = resolve(here, '..', 'data');

const sources = [
  { src: 'aromas_data.js',       out: 'aromas.json',       varName: 'aromasData' },
  { src: 'piramides_data.js',    out: 'piramides.json',    varName: 'piramidesData' },
  { src: 'comentarios_data.js',  out: 'comentarios.json',  varName: 'comentariosData' },
];

function stripWindowAssignment(code, varName) {
  const start = code.indexOf('=');
  if (start === -1) throw new Error(`No se encontró '=' en ${varName}`);
  let body = code.slice(start + 1).trim();
  if (body.endsWith(';')) body = body.slice(0, -1).trim();
  return body;
}

for (const { src, out, varName } of sources) {
  const srcPath = resolve(repoRoot, src);
  const outPath = resolve(outDir, out);
  process.stdout.write(`Convirtiendo ${src} → data/${out} ... `);
  try {
    const raw = await readFile(srcPath, 'utf8');
    const body = stripWindowAssignment(raw, varName);
    const parsed = JSON.parse(body);
    await writeFile(outPath, JSON.stringify(parsed), 'utf8');
    const sizeMb = (Buffer.byteLength(JSON.stringify(parsed), 'utf8') / 1024 / 1024).toFixed(2);
    console.log(`OK (${sizeMb} MB)`);
  } catch (err) {
    console.log('ERROR');
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
}
