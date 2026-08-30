import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["src/**/*.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        cancelAnimationFrame: "readonly",
        console: "readonly",
        devicePixelRatio: "readonly",
        document: "readonly",
        HTMLElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLCanvasElement: "readonly",
        IntersectionObserver: "readonly",
        matchMedia: "readonly",
        MutationObserver: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
        ResizeObserver: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-unreachable": "error"
    }
  }
]);
