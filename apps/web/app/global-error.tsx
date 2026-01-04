"use client";

import { Button } from "@repo/ui/components/ui/button";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
            <body className="flex min-h-screen flex-col items-center justify-center bg-background font-sans text-foreground">
                <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center p-8 text-center">
                    <h2 className="mb-4 text-2xl font-bold tracking-tight">
                        Something went wrong!
                    </h2>
                    <p className="mb-8 text-muted-foreground text-sm">
                        A critical error occurred. Please try refreshing the page.
                    </p>
                    <div className="flex gap-4">
                        <Button onClick={() => reset()}>Try again</Button>
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            Reload Page
                        </Button>
                    </div>
                    {process.env.NODE_ENV === "development" && (
                        <div className="mt-8 max-w-full overflow-auto rounded bg-muted p-4 text-left font-mono text-xs">
                            <p className="font-bold text-destructive">Error Details:</p>
                            <pre>{error.message}</pre>
                            {error.digest && <pre className="mt-2 text-muted-foreground">Digest: {error.digest}</pre>}
                        </div>
                    )}
                </div>
            </body>
        </html>
    );
}
