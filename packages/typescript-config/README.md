# @repo/typescript-config

Shared TypeScript configurations for the Antigravity SaaS monorepo.

## Usage

Extend one of the base configurations in your `tsconfig.json`:

### Next.js Apps

```json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### React Libraries

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### Base (Node.js)

```json
{
  "extends": "@repo/typescript-config/base.json"
}
```
