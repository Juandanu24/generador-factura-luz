// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // host: true expone el dev server en la red local para poder probar desde el celular
  server: { host: true, port: 4321 },
  vite: {
    plugins: [tailwindcss()],
  },
});
