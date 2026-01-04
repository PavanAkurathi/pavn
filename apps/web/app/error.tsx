"use client";

import { useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-full min-h-[400px] w-full flex-col items-center justify-center gap-4 p-4 text-center">
            <div className="rounded-full bg-destructive/10 p-4 text-destructive">
                <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
                Something went wrong!
            </h2>
            <p className="max-w-[500px] text-muted-foreground text-sm">
                We encountered an unexpected error while processing your request.
            </p>
            <div className="flex gap-2">
                <Button onClick={() => reset()}>Try again</Button>
            </div>
            {process.env.NODE_ENV === "development" && (
                <div className="mt-4 max-w-lg overflow-auto rounded bg-muted p-4 text-left font-mono text-xs">
                    <p className="font-bold text-destructive">Dev Error:</p>
                    <pre className="whitespace-pre-wrap break-all">{error.message}</pre>
                </div>
            )}
        </div>
    );
}
