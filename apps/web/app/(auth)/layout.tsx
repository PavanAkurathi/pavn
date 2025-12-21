import Link from "next/link";
import { Command } from "lucide-react";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen w-full bg-slate-50">
            {/* Left Side - Visuals (Desktop Only) */}
            <div className="hidden lg:flex w-1/2 bg-slate-900 flex-col justify-between p-12 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-3xl font-extrabold mb-4">The OS for Modern Hospitality</h2>
                    <p className="text-slate-400 text-lg max-w-md leading-relaxed">
                        Join thousands of venues managing their workforce smarter, faster, and more fairly with Workers Hive.
                    </p>
                </div>

                {/* Abstract pattern or decoration could go here */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-red-600/10 rounded-full blur-3xl rounded-bl-none"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl"></div>

                <div className="relative z-10">
                    <blockquote className="space-y-2">
                        <p className="text-lg">
                            &ldquo;Since switching to Workers Hive, our scheduling time dropped by 80%. It's a game changer.&rdquo;
                        </p>
                        <footer className="text-sm text-slate-400 font-medium">Sofie R. - Operations Director at Bean & Brew</footer>
                    </blockquote>
                </div>
            </div>

            {/* Right Side - Form Content */}
            <div className="w-full lg:w-1/2 flex flex-col h-screen">
                {/* Minimal Header */}
                <header className="flex-none p-6 md:p-8 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl text-slate-900 tracking-tight hover:opacity-80 transition-opacity">
                        <div className="bg-black text-white p-1 rounded-md">
                            <Command className="w-5 h-5" />
                        </div>
                        Workers Hive
                    </Link>
                </header>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-col items-center justify-center min-h-full p-6 md:p-12 lg:px-24">
                        <div className="w-full max-w-md space-y-8">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
