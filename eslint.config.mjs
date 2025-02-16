import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import _import from "eslint-plugin-import";
import globals from "globals";
import unusedImports from "eslint-plugin-unused-imports";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  ...fixupConfigRules(
    compat.extends(
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:@typescript-eslint/recommended-requiring-type-checking",
      "plugin:prettier/recommended",
      "plugin:import/errors",
      "plugin:import/warnings",
      "plugin:import/typescript"
    )
  ).map(config => ({
    ...config,
    files: ["src/**/*.ts"]
  })),
  {
    files: ["src/**/*.ts"],

    plugins: {
      "@typescript-eslint": fixupPluginRules(typescriptEslint),
      import: fixupPluginRules(_import),
      "unused-imports": unusedImports,
      "simple-import-sort": simpleImportSort
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },

      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "module",

      parserOptions: {
        project: "tsconfig.json"
      }
    },

    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"]
      },

      "import/resolver": {
        typescript: {}
      }
    },

    rules: {
      "@typescript-eslint/array-type": "error",
      "@typescript-eslint/consistent-type-assertions": "error",
      "@typescript-eslint/consistent-type-definitions": "error",
      "@typescript-eslint/explicit-function-return-type": "off",

      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "explicit"
        }
      ],

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-parameter-properties": "off",

      "@typescript-eslint/no-shadow": [
        "error",
        {
          hoist: "all"
        }
      ],

      "@typescript-eslint/no-unused-expressions": "error",

      "@typescript-eslint/no-use-before-define": [
        "error",
        {
          functions: false
        }
      ],

      "@typescript-eslint/prefer-for-of": "error",
      "@typescript-eslint/unified-signatures": "error",
      "arrow-parens": ["off", "as-needed"],
      camelcase: "error",
      complexity: "off",
      "dot-notation": "error",
      "eol-last": "off",
      eqeqeq: ["error", "smart"],
      "guard-for-in": "off",

      "id-blacklist": ["error", "any", "Number", "number", "String", "string", "Boolean", "boolean", "Undefined"],

      "id-match": "error",
      "linebreak-style": "off",
      "max-classes-per-file": ["error", 1],
      "new-parens": "off",
      "newline-per-chained-call": "off",
      "no-bitwise": "error",
      "no-caller": "error",
      "no-cond-assign": "error",
      "no-console": "off",
      "no-eval": "error",
      "no-invalid-this": "off",
      "no-multiple-empty-lines": "off",
      "no-new-wrappers": "error",
      "no-shadow": "off",
      "no-throw-literal": "error",
      "no-trailing-spaces": "off",
      "no-undef-init": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "one-var": ["error", "never"],
      "quote-props": "off",
      radix: "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" }
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "spaced-comment": "error"
    }
  }
];
