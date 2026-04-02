'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@repo/ui/lib/utils';

export function PublicHeader() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const navLinks = [
        { name: 'File', href: '/how-it-works' },
        { name: 'View', href: '/features' },
        { name: 'Tools', href: '/pricing' },
        { name: 'Locations', href: '/locations' },
        { name: 'Help', href: '/resources' },
    ];

    return (
        <header
            className="fixed top-0 w-full z-50"
            style={{ fontFamily: 'Tahoma, "MS Sans Serif", Arial, sans-serif' }}
        >
            {/* Title Bar */}
            <div
                className="h-8 flex items-center justify-between px-2 select-none"
                style={{
                    background: 'linear-gradient(to right, #0a246a, #3a6ea5)',
                    borderBottom: '1px solid #0a246a',
                }}
            >
                {/* Window title left side */}
                <div className="flex items-center gap-1.5">
                    {/* App icon */}
                    <div
                        className="w-4 h-4 flex items-center justify-center text-[9px] font-black text-white"
                        style={{
                            background: 'linear-gradient(135deg, #fffb00, #ff8c00)',
                            border: '1px solid rgba(0,0,0,0.4)',
                        }}
                    >
                        W
                    </div>
                    <span className="text-white text-xs font-bold tracking-wide">
                        Workers Hive - Microsoft Internet Explorer
                    </span>
                </div>

                {/* Window control buttons */}
                <div className="flex items-center gap-0.5">
                    {/* Minimize */}
                    <button
                        className="w-6 h-5 text-[11px] font-black text-black flex items-end justify-center pb-0.5"
                        style={{
                            background: 'linear-gradient(180deg, #dce4f5 0%, #b0c4de 100%)',
                            border: '1px solid #6b7faa',
                            boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.8)',
                        }}
                    >
                        _
                    </button>
                    {/* Maximize */}
                    <button
                        className="w-6 h-5 text-[9px] font-black text-black flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(180deg, #dce4f5 0%, #b0c4de 100%)',
                            border: '1px solid #6b7faa',
                            boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.8)',
                        }}
                    >
                        □
                    </button>
                    {/* Close */}
                    <button
                        className="w-6 h-5 text-[11px] font-black text-white flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(180deg, #d9534f 0%, #9b1c1c 100%)',
                            border: '1px solid #7a1010',
                            boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.3)',
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Menu Bar */}
            <div
                className="h-7 flex items-center px-2 gap-0"
                style={{
                    background: '#ece9d8',
                    borderBottom: '1px solid #aca899',
                }}
            >
                {/* Logo mark */}
                <Link href="/" className="flex items-center gap-1.5 mr-4">
                    <div
                        className="px-2 py-0.5 text-xs font-black text-white"
                        style={{
                            background: '#0a246a',
                            border: '1px solid #00007f',
                        }}
                    >
                        W
                    </div>
                    <span className="text-[11px] font-bold text-gray-800">Workers Hive</span>
                    <span
                        className="text-[8px] font-bold px-1 py-0.5"
                        style={{
                            background: '#316ac5',
                            color: '#fff',
                            border: '1px solid #1a45a0',
                        }}
                    >
                        BETA
                    </span>
                </Link>

                {/* Menu items */}
                <nav className="hidden md:flex items-center">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                'px-3 py-1 text-[11px] text-gray-800 hover:bg-[#316ac5] hover:text-white transition-none',
                                pathname === link.href && 'bg-[#316ac5] text-white'
                            )}
                            style={{ textDecoration: 'underline' }}
                        >
                            {link.name}
                        </Link>
                    ))}
                </nav>

                <div className="hidden md:flex items-center gap-2 ml-auto">
                    <Link
                        href="/auth/sign-in"
                        className="text-[11px] text-gray-800 hover:text-[#0000ee] underline"
                    >
                        Log in
                    </Link>
                    <Link href="/register">
                        <button
                            className="px-3 py-0.5 text-[11px] font-bold text-black"
                            style={{
                                background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                                border: '2px solid',
                                borderColor: '#ffffff #808080 #808080 #ffffff',
                                outline: '1px solid #0a246a',
                            }}
                        >
                            Start Free Trial
                        </button>
                    </Link>
                </div>

                {/* Mobile toggle */}
                <button
                    className="md:hidden ml-auto text-xs px-2 py-0.5"
                    style={{
                        background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                        border: '2px solid',
                        borderColor: '#ffffff #808080 #808080 #ffffff',
                    }}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? '▲ Menu' : '▼ Menu'}
                </button>
            </div>

            {/* Address bar */}
            <div
                className="h-8 hidden md:flex items-center px-2 gap-2"
                style={{
                    background: '#ece9d8',
                    borderBottom: '2px solid #aca899',
                }}
            >
                <span className="text-[11px] text-gray-700 font-bold">Address</span>
                <div
                    className="flex-1 h-5 px-2 flex items-center text-[11px] text-blue-800"
                    style={{
                        background: '#fff',
                        border: '2px solid',
                        borderColor: '#808080 #ffffff #ffffff #808080',
                    }}
                >
                    https://workershive.com/
                </div>
                <button
                    className="px-3 py-0.5 text-[11px] font-bold text-black"
                    style={{
                        background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                        border: '2px solid',
                        borderColor: '#ffffff #808080 #808080 #ffffff',
                    }}
                >
                    Go
                </button>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div
                    className="md:hidden absolute w-full p-3 flex flex-col gap-2 z-50"
                    style={{
                        background: '#ece9d8',
                        border: '2px solid',
                        borderColor: '#ffffff #808080 #808080 #ffffff',
                        boxShadow: '2px 2px 4px rgba(0,0,0,0.4)',
                    }}
                >
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setIsOpen(false)}
                            className="text-[12px] text-blue-800 underline hover:text-blue-600 px-2 py-1"
                            style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}
                        >
                            {link.name}
                        </Link>
                    ))}
                    <div
                        className="border-t pt-2 mt-1 flex flex-col gap-2"
                        style={{ borderColor: '#aca899' }}
                    >
                        <Link href="/auth/sign-in" onClick={() => setIsOpen(false)}>
                            <button
                                className="w-full text-[11px] py-1 font-bold text-black"
                                style={{
                                    background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                                    border: '2px solid',
                                    borderColor: '#ffffff #808080 #808080 #ffffff',
                                }}
                            >
                                Log in
                            </button>
                        </Link>
                        <Link href="/register" onClick={() => setIsOpen(false)}>
                            <button
                                className="w-full text-[11px] py-1 font-bold text-black"
                                style={{
                                    background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                                    border: '2px solid',
                                    borderColor: '#ffffff #808080 #808080 #ffffff',
                                    outline: '1px solid #0a246a',
                                }}
                            >
                                Start Free Trial
                            </button>
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
}
