# @repo/typescript-config

Shared TypeScript configurations for the monorepo.

## Available Configs

- \`base.json\`: The strict base configuration used by most packages.
- \`nextjs.json\`: Configuration tailored for Next.js applications (apps/web).
- \`react-library.json\`: Configuration for React component libraries (@repo/ui).

## Usage

In your package's \`tsconfig.json\`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```
