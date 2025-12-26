# @repo/ui

Shared UI component library for the Antigravity SaaS platform. Built with [Radix UI](https://www.radix-ui.com/) and [Tailwind CSS](https://tailwindcss.com/).

## Components

Includes a comprehensive set of accessible components:
-   Primitives: Buttons, Inputs, Dialogs, Popovers.
-   Layout: Cards, Avalars, Separators.
-   Data Display: Tables, Badges, Tooltips.

## Usage

Import components directly into your application:

```tsx
import { Button } from "@repo/ui/components/ui/button";

export default function Page() {
    return <Button>Click me</Button>;
}
```

## Styling

This package exports a global stylesheet that should be imported in the root layout of your application.

```tsx
import "@repo/ui/globals.css";
```
