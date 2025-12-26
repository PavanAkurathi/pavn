# @repo/eslint-config

Shared ESLint configurations for the Antigravity SaaS monorepo.

## Usage

Extend one of the available configurations in your package's `eslint.config.js` or `.eslintrc.js`:

### Next.js Apps

```js
import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */
export default nextJsConfig;
```

### React Libraries

```js
import { config } from "@repo/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default config;
```

### Base (Node.js)

```js
import { config } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config} */
export default config;
```
