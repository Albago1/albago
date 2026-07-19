import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code scratch worktrees — never lint tool-managed copies.
    ".claude/**",
  ]),
  {
    rules: {
      // Existing mount-time init patterns (localStorage hydration, admin
      // fetch-on-mount, palette open/close sync) predate this rule becoming
      // an error. Kept visible as warnings; migrate call sites gradually
      // instead of blocking lint. Do not add new violations.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
