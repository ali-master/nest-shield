import antfu from "@antfu/eslint-config";
import nextPlugin from "@next/eslint-plugin-next";
import jestDom from "eslint-plugin-jest-dom";
import jsxA11y from "eslint-plugin-jsx-a11y";
import playwright from "eslint-plugin-playwright";
import testingLibrary from "eslint-plugin-testing-library";

export default antfu(
  {
    react: true,
    typescript: true,

    lessOpinionated: true,
    isInEditor: false,

    formatters: {
      prettierOptions: {
        printWidth: 100,
        trailingComma: "all",
        singleQuote: false,
        semi: true,
        tabWidth: 2,
        quoteProps: "as-needed",
        jsxSingleQuote: false,
        arrowParens: "always",
      },
    },
    stylistic: false,

    ignores: ["migrations/**/*", "next-env.d.ts", "scripts/**/*", ".next/**/*", "node_modules/**/*", "docs/**/*"],
  },
  jsxA11y.flatConfigs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    files: ["**/*.test.ts?(x)"],
    ...testingLibrary.configs["flat/react"],
    ...jestDom.configs["flat/recommended"],
  },
  {
    files: ["**/*.spec.ts", "**/*.e2e.ts"],
    ...playwright.configs["flat/recommended"],
  },
  {
    rules: {
      "antfu/no-top-level-await": "off", // Allow top-level await
      "perfectionist/sort-imports": "off",
      "no-console": ["error", { allow: ["warn", "error", "log"] }],
      "jsx-a11y/media-has-caption": "off",
      "ts/consistent-type-definitions": ["error", "type"], // Use `type` instead of `interface`
      "react/prefer-destructuring-assignment": "off", // Vscode doesn't support automatically destructuring, it's a pain to add a new variable
      "node/prefer-global/process": "off", // Allow using `process.env`
      "ts/ban-ts-comment": "off",
      // Disable some problematic rules
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "error",
      "no-unused-vars": "off", // Use TypeScript's unused variable checking instead
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "unused-imports/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    },
  },
);
