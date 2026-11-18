import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Chemins relatifs : fonctionne sous /WEB_UML_Editor/ sur GitHub Pages
  base: './',
  server: { port: 5173 },
});
