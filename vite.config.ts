import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/vicia/",
  server: {
    port: 8080,
    open: true,
  },
});
