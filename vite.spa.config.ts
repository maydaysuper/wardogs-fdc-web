import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", port: 8080, strictPort: true },
  preview: { host: "0.0.0.0", port: 8080, strictPort: true },
  plugins: [tailwindcss(), viteReact()],
  resolve: { tsconfigPaths: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: "index.html",
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react") || id.includes("scheduler")) return "react";
          if (id.includes("@tanstack")) return "tanstack";
          return "vendor";
        },
      },
    },
  },
});
