import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  // Event Engine boundary (docs/engine/phase-0-plan.md §5.2): the engine is
  // customer-neutral and must stay movable to its own repository.
  {
    files: ["engine/**/*.{ts,tsx,mts}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "next", message: "The engine must not depend on Next.js." },
          { name: "react", message: "The engine must not depend on React." },
          { name: "react-dom", message: "The engine must not depend on React." },
          { name: "server-only", message: "The engine is runtime-neutral; guard at the caller." },
        ],
        patterns: [
          { group: ["next/*"], message: "The engine must not depend on Next.js." },
          { group: ["@/app/*", "@/components/*", "@/lib/*", "@/hooks/*", "@/types/*", "@/integrations/*", "@/scripts/*"],
            message: "The engine must not import AlbaGo code — pass it in through a port." },
          { regex: "^(\.\./)+(app|components|lib|hooks|types|integrations|scripts)(/|$)",
            message: "The engine must not import AlbaGo code — pass it in through a port." },
        ],
      }],
      "no-restricted-properties": ["error",
        { object: "process", property: "env", message: "Engine config arrives through ports, not process.env." },
      ],
    },
  },
  // Outside the engine, only its public entry points may be imported.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "integrations/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/engine/*", "!@/engine/server"], message: "Import the engine through its public API: '@/engine' or '@/engine/server'." },
        ],
      }],
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code scratch worktrees — never lint tool-managed copies.
    ".claude/**",
  ]),
]);

export default eslintConfig;
