import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
            <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center p-8 text-center">
                <h1 className="mb-4 text-4xl font-extrabold tracking-tight lg:text-5xl">
                    404
                </h1>
                <h2 className="mb-4 text-xl font-semibold tracking-tight">
                    Page Not Found
                </h2>
                <p className="mb-8 text-muted-foreground">
                    Sorry, we couldn't find the page you're looking for. It might have been
                    removed or doesn't exist.
                </p>
                <Button asChild>
                    <Link href="/">Return Home</Link>
                </Button>
            </div>
        </div>
    );
}
