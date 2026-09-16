import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const pages = process.env.GITHUB_PAGES === "1";

export default defineConfig({
  base: pages ? "/wardogs-fdc-web/" : "/",
  server: { host: "0.0.0.0", port: 8080, strictPort: true },
  plugins: [tailwindcss(), viteReact()],
  resolve: { tsconfigPaths: true },
  build: {
    outDir: "dist-spa",
    emptyOutDir: true,
    rollupOptions: {
      input: "spa.html",
    },
  },
});
