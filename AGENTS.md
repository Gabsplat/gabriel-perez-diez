# Portfolio de Gabriel Pérez Diez

El sitio vive en `glyph-astro/` (Astro + WebGL) y se publica en https://gabsplat.dev
con un Worker de Cloudflare. Usar siempre `pnpm`.

## Publicar: commit, push y recién después producción

Producción tiene que coincidir siempre con lo que está en GitHub. Nunca publicar
cambios sin commitear ni desde copias del proyecto.

1. Commitear los cambios.
2. Pushear la rama a `origin` (https://github.com/Gabsplat/gabriel-perez-diez).
3. Publicar desde `glyph-astro/`:

   ```bash
   pnpm build && pnpm dlx wrangler deploy
   ```

   `wrangler.jsonc` ya define el dominio `gabsplat.dev`; wrangler está logueado.
4. Verificar en https://gabsplat.dev (`/`, `/en/`) que respondan y muestren el cambio.

## Privacidad

El repo es público. La foto y el video de la familia (`glyph-astro/public/family/`)
están en `.gitignore`: se publican en el sitio, en la página no listada `/family`,
pero nunca se commitean. Lo mismo para cualquier foto personal nueva.
