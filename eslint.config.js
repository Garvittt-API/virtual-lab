import js from "@eslint/js";
import globals from "globals";
export default [
  { ignores: ["dist/**", "node_modules/**", "artifacts/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { args: "none", varsIgnorePattern: "^(React|[A-Z])" },
      ],
    },
  },
];
