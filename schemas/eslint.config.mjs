// @ts-check

import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default defineConfig([
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "public/**",
      "tsup.config.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        // @ts-expect-error -- injected by runtime, not typed by TS
        tsconfigRootDir: import.meta.dirname,
        projectService: true,
      },
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      // "@typescript-eslint/no-confusing-void-expression": "off",
      // "@typescript-eslint/restrict-template-expressions": "off",
      // "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          vars: "all",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
        },
      ],
      // "@typescript-eslint/no-unsafe-return": "off",
      // "@typescript-eslint/no-unsafe-assignment": "off",
      // "@typescript-eslint/prefer-nullish-coalescing": "off",
      // "@typescript-eslint/no-empty-object-type": "off",
      // "@typescript-eslint/no-explicit-any": "off",
      // "prefer-rest-params": "off",
      // "@typescript-eslint/array-type": "off",
      // "@typescript-eslint/no-misused-promises": "off",
      // "@typescript-eslint/consistent-type-imports": "error",
      // "@typescript-eslint/no-inferrable-types": [
      //   "error",
      //   {
      //     ignoreParameters: true,
      //     ignoreProperties: true,
      //   },
      // ],
    },
  },
]);
