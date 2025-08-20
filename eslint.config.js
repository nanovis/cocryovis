// @ts-check

import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";
import jsdoc from "eslint-plugin-jsdoc";

export default defineConfig([
    jsdoc.configs["flat/recommended-error"],
    {
        files: ["**/*.{js,mjs,cjs}"],
        plugins: { js, jsdoc },
        extends: ["js/recommended"],
        languageOptions: { globals: globals.node },
        rules: {
            "no-unused-vars": 0,
            "jsdoc/no-undefined-types": 0,
            "jsdoc/check-indentation": 0,
            "jsdoc/check-line-alignment": 1,
            "jsdoc/check-template-names": 0,
            "jsdoc/check-syntax": 1,
            "jsdoc/no-bad-blocks": 1,
            "jsdoc/no-blank-block-descriptions": 1,
            "jsdoc/no-defaults": 1,
            "jsdoc/require-asterisk-prefix": 1,
            "jsdoc/require-jsdoc": 0, // Recommended
            "jsdoc/require-param-description": 0, // Recommended
            "jsdoc/require-property-description": 0, // Recommended
            "jsdoc/require-returns": 0, // Recommended
            "jsdoc/require-returns-check": 0, // Recommended
            "jsdoc/require-returns-description": 0, // Recommended
            "jsdoc/require-template": 1,
            "jsdoc/require-yields": 0, // Recommended
            "jsdoc/valid-types": 0, // Recommended
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
