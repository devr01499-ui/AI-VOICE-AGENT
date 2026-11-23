// ESLint for the whole repo: Vite + React SPA (Frontend/) and Express + Prisma (server/).
// Focus: rules that catch real defects (hook order, unreachable code, duplicate keys,
// undefined names in plain JS). Style is not linted. Type errors are tsc's job
// (npm run typecheck), so no type-aware rules run here: lint stays fast.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/test-results/**",
    "**/playwright-report/**",
    "repo/**",
    "Frontend/public/**",
    "server/src/generated/**",
    "**/*.min.js",
  ]),
  {
    files: ["**/*.{js,cjs,mjs,jsx,ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      globals: { ...globals.node, ...globals.browser },
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      // Style/typing debt, not defects: reported as warnings so they stay visible
      // without blocking. CommonJS test scripts use require() on purpose.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
      "@typescript-eslint/no-this-alias": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "prefer-const": "warn",
      "no-useless-escape": "warn",
      // Sanitisers strip NUL/control bytes on purpose.
      "no-control-regex": "off",
    },
  },
  {
    // React apps: hook-order violations crash at runtime, so they block.
    files: ["Frontend/src/**/*.{ts,tsx}", "Admin/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);
