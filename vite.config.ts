import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import packageMetadata from "./package.json";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(packageMetadata.version)
  },
  clearScreen: false,
  server: {
    strictPort: true,
    port: 1420
  }
});
