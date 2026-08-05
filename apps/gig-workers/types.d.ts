/// <reference types="jest" />

// Uniwind/Tailwind stylesheets are imported for their side effects only; TS
// needs a module declaration or the import in app/_layout.tsx fails to resolve.
declare module "*.css";
