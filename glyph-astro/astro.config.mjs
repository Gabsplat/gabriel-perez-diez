import { defineConfig } from 'astro/config';

export default defineConfig({
  devToolbar: { enabled: false },
  server: { host: true, port: 4331 },
  vite: { server: { allowedHosts: true } },
});
