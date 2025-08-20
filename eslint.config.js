// @ts-check

import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    {
        files: ["**/*.{js,mjs,cjs}"],
        plugins: { js },
        extends: ["js/recommended"],
        languageOptions: { globals: globals.node },
        rules: {
            "no-unused-vars": 0,
        },
    },
    globalIgnores([
        "client/*",
        "data/*",
        "demo/*",
        "logs/*",
        "modules/*",
        "node_modules/*",
        "sessions/*",
        "transfer-functions/*",
        "*.json",
        "*.log",
        "*.sh",
        "*.yaml",
        "*.yml",
        "*.md",

        // exceptions (negations)
        "!package.json",
        "!tsconfig*.json",
        "!nodemon.json",
        "!jsconfig.json",
        "!config.json",
        ".config/*",
    ]),
]);
