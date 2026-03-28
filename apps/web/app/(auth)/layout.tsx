import Link from "next/link";
import { Command } from "lucide-react";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen w-full bg-muted/20">
            <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-foreground p-12 text-background lg:flex">
                <div className="relative z-10">
                    <h2 className="text-3xl font-extrabold mb-4">The OS for Modern Hospitality</h2>
                    <p className="max-w-md text-lg leading-relaxed text-background/70">
                        Flat-rate scheduling and GPS timekeeping built for hospitality. No per-user fees. No contracts.
                    </p>
                </div>

                <div className="absolute right-0 top-0 -mr-20 -mt-20 h-96 w-96 rounded-full rounded-bl-none bg-primary/15 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-80 w-80 rounded-full bg-background/10 blur-3xl"></div>

                <div className="relative z-10" />
            </div>

            <div className="flex h-screen w-full flex-col lg:w-1/2">
                <header className="flex-none p-6 md:p-8">
                    <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground transition-opacity hover:opacity-80">
                        <div className="rounded-md bg-primary p-1 text-primary-foreground">
                            <Command className="w-5 h-5" />
                        </div>
                        Workers Hive
                    </Link>
                </header>

                <div className="flex-1 overflow-y-auto">
                    <div className="flex min-h-full flex-col items-center justify-center p-6 md:p-12 lg:px-24">
                        <div className="flex w-full max-w-md flex-col gap-8">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
