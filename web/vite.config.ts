import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";
import { fileURLToPath } from "url";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: resolve(here, "../dist/web"),
    emptyOutDir: true,
    // Single HTML output with everything inlined — served by dagdo's
    // node http server at `/`, so zero static asset plumbing.
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
