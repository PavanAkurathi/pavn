import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
    ...nextJsConfig,
    {
        files: ["**/*.{ts,tsx}"],
        rules: {
            // The web app talks to the API; it never reads the database itself.
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["@repo/database", "@repo/database/*"],
                            message:
                                "apps/web never imports @repo/database: go through the API (docs/architecture/api-first-backend-blueprint.md).",
                        },
                    ],
                },
            ],
        },
    },
];
