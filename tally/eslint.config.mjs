import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // Security doc §3.3: the one way to switch off React's automatic escaping.
      "react/no-danger": "error",
    },
  },

  {
    // Architecture doc §4: the UI must never know where data lives.
    // Everything goes through the Repository interface in src/data.
    files: ["src/features/**", "src/components/**", "src/app/**", "src/store/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["dexie", "**/data/local/*", "@/data/local/*"],
              message:
                "Access data only through the Repository interface (@/data).",
            },
          ],
        },
      ],
    },
  },

  {
    // lib/dates.ts is the only file allowed to touch date-fns (architecture §5).
    files: ["src/**"],
    ignores: ["src/lib/dates.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["date-fns", "date-fns/*", "date-fns-tz", "date-fns-tz/*"],
              message: "All date logic belongs in @/lib/dates.",
            },
            {
              group: ["dexie", "**/data/local/*", "@/data/local/*"],
              message:
                "Access data only through the Repository interface (@/data).",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/data/**", "src/lib/dates.ts"],
    rules: { "no-restricted-imports": "off" },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
