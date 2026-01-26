// apps/web/components/nav-header.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { authClient } from "@repo/auth/client";
import { Plus, Building2, Bell } from "lucide-react";
import { NavUser } from "./nav-user";

const NAV_ITEMS = [
    { label: "Shifts", href: "/dashboard/shifts" },
    { label: "Rosters", href: "/rosters" },
    { label: "Reports", href: "/reports" },
    { label: "Availability", href: "/dashboard/availability" }, // [AVL-006]
];

interface NavHeaderProps {
    activeOrg?: {
        id: string;
        name: string;
        logo?: string | null;
    } | null;
}

export function NavHeader({ activeOrg: serverOrg }: NavHeaderProps) {
    const pathname = usePathname();
    const { data: clientOrg } = authClient.useActiveOrganization();
    const activeOrg = clientOrg || serverOrg;

    // Distraction-free mode for creation flows
    if (pathname.startsWith("/dashboard/schedule/create")) {
        return null;
    }

    return (
        <header className="sticky top-0 z-40 w-full border-b bg-white">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                {/* Left: Logo & Nav */}
                <div className="flex items-center gap-8">
                    {/* Logo (Business Identity) */}
                    <Link href="/dashboard/shifts" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                        <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden shadow-sm">
                            {activeOrg?.logo ? (
                                <img src={activeOrg.logo} alt={activeOrg.name} className="h-full w-full object-cover" />
                            ) : (
                                activeOrg ? <Building2 className="h-5 w-5" /> : "W"
                            )}
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="font-bold text-sm tracking-tight text-slate-900 leading-none mb-0.5">
                                {activeOrg?.name || "Workers Hive"}
                            </span>
                            {activeOrg && (
                                <span className="text-[10px] font-medium text-slate-500 leading-none uppercase tracking-wider">
                                    Workers Hive
                                </span>
                            )}
                        </div>
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
                    <Link href="/dashboard/schedule/create">
                        <Button className="hidden sm:flex bg-slate-900 hover:bg-slate-800 text-white gap-2 font-medium" size="sm">
                            <Plus className="w-4 h-4" />
                            Create a schedule
                        </Button>
                    </Link>

                    <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                    <Link href="/settings?tab=notifications">
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                            <Bell className="h-5 w-5" />
                        </Button>
                    </Link>

                    <NavUser />
                </div>
            </div>
            {/* Mobile Nav Placeholder (Optional - can be expanded later) */}
        </header>
    );
}
