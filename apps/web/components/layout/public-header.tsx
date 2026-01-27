'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import { Command, Menu, X } from 'lucide-react';
import { cn } from '@repo/ui/lib/utils';

export function PublicHeader() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const navLinks = [
        { name: 'Pricing', href: '/pricing' },
        { name: 'Locations', href: '/locations' },
        { name: 'Resources', href: '/resources' },
    ];

    return (
        <header className="fixed top-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-slate-200">
            <div className="container mx-auto px-6 h-20 flex items-center justify-between">

                {/* Logo */}
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900">
                    <div className="bg-slate-900 text-white p-1 rounded-lg">
                        <Command className="w-5 h-5" />
                    </div>
                    Workers Hive
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 uppercase tracking-wide">
                        BETA
                    </span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "hover:text-slate-900 transition-colors",
                                pathname === link.href && "text-red-600 font-bold"
                            )}
                        >
                            {link.name}
                        </Link>
                    ))}
                </nav>

                {/* Auth Buttons (Desktop) */}
                <div className="hidden md:flex items-center gap-4">
                    <Link
                        href="/auth/sign-in"
                        className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                        Log in
                    </Link>
                    <Link href="/register">
                        <Button className="font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20">
                            Start Free Trial
                        </Button>
                    </Link>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden text-slate-900"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {isOpen && (
                <div className="md:hidden absolute top-20 left-0 w-full bg-white border-b border-slate-200 p-6 flex flex-col gap-6 shadow-xl animate-in slide-in-from-top-5">
                    <nav className="flex flex-col gap-4 text-lg font-medium text-slate-600">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsOpen(false)}
                                className="hover:text-red-600"
                            >
                                {link.name}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                        <Link href="/auth/sign-in" onClick={() => setIsOpen(false)}>
                            <Button variant="outline" className="w-full justify-center">Log in</Button>
                        </Link>
                        <Link href="/register" onClick={() => setIsOpen(false)}>
                            <Button className="w-full justify-center bg-red-600 hover:bg-red-700">Start Free Trial</Button>
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
}
