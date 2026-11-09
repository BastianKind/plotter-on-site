import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths, so the build works from any folder (e.g. GitHub Pages under /plotter-on-site/).
  base: './',
  // Port 5175, next to the web shop (5173) and the kiosk (5174).
  server: { port: 5175 },
});
