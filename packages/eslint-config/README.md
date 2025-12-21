# @repo/eslint-config

Shared ESLint configurations for the monorepo.

## Available Configs

- \`library.js\`: Standard config for backend/utility libraries.
- \`next.js\`: Config for Next.js applications.
- \`react-internal.js\`: Config for internal React libraries.

## Usage

In your package's \`eslint.config.js\` (or \`.eslintrc.js\`):

```javascript
import { config } from "@repo/eslint-config/library";

export default config;
```
