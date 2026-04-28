# perfume-data API

API privada en Netlify Functions que sirve los datos de comentarios, aromas y notas como **HTML ya renderizado**, evitando exponer los JSON originales como assets públicos del theme.

## Qué cambia respecto al enfoque anterior

| Antes | Ahora |
|---|---|
| `<script src="comentarios_data.js">` con 6 MB accesible a cualquiera | Endpoint privado que devuelve sólo el HTML del SKU pedido |
| `window.comentariosData` disponible en el navegador | No existe ningún objeto global con todo el catálogo |
| Un `curl` a `asset_url` descarga todo | Cada SKU es un request separado con rate limit + validación de Origin |

## Estructura

```
netlify-api/
├── netlify.toml                    configuración y redirects /api/*
├── package.json                    deps y scripts
├── .env.example                    variables a configurar en Netlify
├── scripts/
│   └── convert-data.mjs            convierte los .js (window.xxx) a .json
├── data/                           JSON bundlados en la función (no públicos)
│   ├── aromas.json
│   ├── piramides.json
│   └── comentarios.json
└── netlify/functions/
    ├── _shared/
    │   ├── security.mjs            Origin check, rate limit, token, escape
    │   └── data.mjs                carga perezosa y cache de JSON
    ├── comentarios.mjs             GET /api/comentarios?sku=XXX
    ├── aromas.mjs                  GET /api/aromas?sku=XXX
    └── notas.mjs                   GET /api/notas?sku=XXX
```

## Pasos de despliegue

### 1. Convertir los datos

Desde `netlify-api/`:

```bash
npm run convert
```

Esto lee `../aromas_data.js`, `../piramides_data.js`, `../comentarios_data.js` y genera los JSON limpios en `data/`.

### 2. Crear el sitio en Netlify

Dos opciones:

**a) CLI** (recomendado)
```bash
npm install -g netlify-cli
netlify login
netlify init              # conecta este directorio como sitio nuevo
netlify deploy --prod
```

**b) Git** — sube `netlify-api/` a un repo y en Netlify elige "Add new site → Import from Git", apuntando la base directory a `netlify-api/`.

### 3. Configurar variables de entorno

En Netlify → Site settings → Environment variables, añade:

| Variable | Valor | Notas |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://tu-tienda.myshopify.com,https://www.tudominio.com` | Obligatorio |
| `RATE_LIMIT_PER_MIN` | `120` | Opcional (120 por defecto) |
| `TOKEN_SALT` | cualquier string | Opcional, activa el token rotativo |

Vuelve a desplegar después de añadirlas (`netlify deploy --prod`).

### 4. Apuntar el Liquid a tu dominio

En cada `.liquid` (aromas, notas, comentarios) sustituye la línea:

```liquid
{%- assign API_BASE = 'https://TU-PROYECTO.netlify.app' -%}
```

por tu dominio Netlify real (o el custom si mapeaste uno).

Si activaste `TOKEN_SALT` en Netlify, pega el mismo valor también en el Liquid:

```liquid
{%- assign TOKEN_SALT = 'el-mismo-valor-que-pusiste-en-netlify' -%}
```

### 5. Eliminar los assets antiguos

Una vez verificado que la página carga bien desde el endpoint, borra de tu theme:

- `comentarios_data.js`
- `aromas_data.js`
- `piramides_data.js`

Esto es lo que te da el beneficio real: deja de existir el archivo público con todo el catálogo.

## Capas de seguridad

1. **Origin / Referer whitelist** — el servidor rechaza cualquier request que no venga de `ALLOWED_ORIGINS`. Se falsifica con herramientas, pero filtra la mayoría del tráfico de scrapers.
2. **Rate limit por IP** — usa Netlify Blobs (sliding window de 60s). Configurable con `RATE_LIMIT_PER_MIN`.
3. **SKU único por request** — nunca se devuelve el catálogo completo, sólo la entrada pedida.
4. **Token rotativo opcional** — si `TOKEN_SALT` está configurado, el Liquid genera `hmac_sha256(sku:hourBucket, salt)` y el servidor lo valida (acepta hora actual y anterior). No es un secreto absoluto (el salt se puede leer del HTML), pero obliga al scraper a ejecutar ese paso.
5. **Cache-Control** — 5 min en CDN con `stale-while-revalidate`; reduce carga y bloquea patrones de abuso.

## Qué NO protege (hay que saberlo)

- Un scraper con navegador headless (Playwright, Puppeteer) verá el HTML igual que un usuario real. Si la página del producto es pública e indexable, el contenido siempre se podrá leer.
- Copiar textos visualmente desde la página. Ninguna API lo impide.

El objetivo realista es **encarecer** el scraping masivo, no hacerlo imposible.

## Desarrollo local

```bash
npm install
netlify dev
```

Abre `http://localhost:8888/api/aromas?sku=TRUE` etc.

Para saltarte el Origin check en local, deja `ALLOWED_ORIGINS` vacío en `.env`.

## Endpoints

Todos responden `text/html; charset=utf-8` o `204 No Content` si no hay datos para el SKU.

- `GET /api/comentarios?sku=XXX[&t=TOKEN]`
- `GET /api/aromas?sku=XXX[&t=TOKEN]`
- `GET /api/notas?sku=XXX[&t=TOKEN]`

Códigos: `200` con HTML · `204` sin datos · `403` origin/token inválido · `429` rate limit.
