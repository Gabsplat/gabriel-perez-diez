import { defineConfig } from 'astro/config';

export default defineConfig({
  devToolbar: { enabled: false },
  // La portada con Mimo vivía en /blob: los enlaces viejos siguen funcionando
  redirects: { '/blob': '/' },
  server: { host: true, port: 4331 },
  vite: { server: { allowedHosts: true } },
});
