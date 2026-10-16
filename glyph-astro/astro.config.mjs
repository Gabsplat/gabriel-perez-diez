import { defineConfig } from 'astro/config';

export default defineConfig({
  devToolbar: { enabled: false },
  // /blob ya no existe: los enlaces viejos llevan a la portada
  redirects: { '/blob': '/' },
  server: { host: true, port: 4331 },
  vite: { server: { allowedHosts: true } },
});
