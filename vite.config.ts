import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
  },
  server: {
    open: true,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./frontend"),
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer', 'process', 'stream-browserify', 'util'],
  },
  base: process.env.NODE_ENV === 'production' ? '/aptos_new_deadlock/' : './',
});
