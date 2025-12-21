# @repo/ui

This package contains the shared UI components for the monorepo, built with **Radix UI** and **Tailwind CSS**. It follows the *shadcn/ui* pattern where components are accessible and customizable.

## Tech Stack

- **Radix UI**: Headless, accessible primitives.
- **Tailwind CSS**: Styling.
- **Lucide React**: Icons.
- **Class Variance Authority (CVA)**: Variant management.

## Project Structure

- \`src/components/ui\`: proper atomic UI components (Button, Input, Card, etc.).
- \`src/lib/utils.ts\`: shared utility functions (cn, clsx).

## Usage

Import components directly from the package path:

```tsx
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";

export default function MyComponent() {
  return (
    <Card>
      <Button>Click me</Button>
    </Card>
  );
}
```

## Adding Components

Components are managed manually. To add a new shadcn/ui component:
1. Run the shadcn CLI in a temp folder or manually copy the primitive code.
2. Place it in \`src/components/ui\`.
3. Ensure it exports correctly.
