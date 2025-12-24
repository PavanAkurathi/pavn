"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { Plus } from "lucide-react";
import { NavUser } from "./nav-user";

const NAV_ITEMS = [
    { label: "Shifts", href: "/dashboard/shifts" },
    { label: "Rosters", href: "/rosters" },
    { label: "Time-sheet", href: "/timesheet" },
    { label: "Reports", href: "/reports" },
];

export function NavHeader() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-40 w-full border-b bg-white">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                {/* Left: Logo & Nav */}
                <div className="flex items-center gap-8">
                    {/* Logo */}
                    <Link href="/dashboard/shifts" className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                            W
                        </div>
                        <span className="font-bold text-lg tracking-tight hidden sm:block">Workers Hive</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {NAV_ITEMS.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "px-3 py-2 text-sm font-medium transition-colors",
                                        isActive
                                            ? "text-primary border-b-2 border-primary"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Right: CTA & User */}
                <div className="flex items-center gap-4">
                    <Button className="hidden sm:flex bg-slate-900 hover:bg-slate-800 text-white gap-2 font-medium" size="sm">
                        <Plus className="w-4 h-4" />
                        Schedule a shift
                    </Button>

                    <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                    <NavUser />
                </div>
            </div>
            {/* Mobile Nav Placeholder (Optional - can be expanded later) */}
        </header>
    );
}
