// @ts-check

import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["dist/**", "build/**", "node_modules/**", "public/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: true,
      },
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // "no-unused-vars": [
      //   "error",
      //   {
      //     args: "all",
      //     argsIgnorePattern: "^_",
      //     vars: "all",
      //     varsIgnorePattern: "^_",
      //     caughtErrors: "all",
      //   },
      // ],
      "no-unused-vars": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unused-vars": ["error"],
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-rest-params": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-inferrable-types": [
        "error",
        {
          ignoreParameters: true,
          ignoreProperties: true,
        },
      ],
    },
  },
]);
