'use client';

import Link from 'next/link';
import { Command, Facebook, Linkedin, Twitter, Instagram } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';

export function PublicFooter() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-black text-slate-400 border-t border-slate-900 font-sans">

            {/* --- TOP SECTION: NEWSLETTER CTA --- */}
            <div className="border-b border-slate-900">
                <div className="container mx-auto px-6 py-12 md:py-16">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="max-w-xl">
                            <h3 className="text-2xl font-bold text-white mb-2">Join the Hive.</h3>
                            <p className="text-slate-400">
                                Get the latest hospitality labor laws, scheduling tips, and product updates sent to your inbox.
                            </p>
                        </div>

                        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
                            <input
                                type="email"
                                placeholder="Enter your work email"
                                className="bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-lg w-full md:w-80 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-slate-600"
                            />
                            <Button className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 h-auto">
                                Subscribe
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MIDDLE SECTION: LINKS GRID --- */}
            <div className="container mx-auto px-6 py-16 md:py-24">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 lg:gap-16">

                    {/* COLUMN 1: BRAND */}
                    <div className="col-span-2 lg:col-span-2">
                        <Link href="/" className="flex items-center gap-2 font-bold text-xl mb-6 text-white tracking-tight">
                            <div className="bg-white text-black p-1 rounded-md">
                                <Command className="w-5 h-5" />
                            </div>
                            Workers Hive
                        </Link>
                        <p className="text-sm leading-relaxed mb-8 max-w-sm text-slate-500">
                            The operating system for modern hospitality groups. We replace clunky legacy software with a fast, flat-rate platform that scales with you.
                        </p>
                        <div className="flex gap-4">
                            <SocialIcon icon={<Twitter className="w-4 h-4" />} href="#" />
                            <SocialIcon icon={<Linkedin className="w-4 h-4" />} href="#" />
                            <SocialIcon icon={<Instagram className="w-4 h-4" />} href="#" />
                            <SocialIcon icon={<Facebook className="w-4 h-4" />} href="#" />
                        </div>
                    </div>

                    {/* COLUMN 2: PRODUCT */}
                    <div>
                        <h4 className="font-bold text-white mb-6">Platform</h4>
                        <ul className="space-y-4 text-sm">
                            <FooterLink href="/pricing" text="Pricing" />
                            <FooterLink href="/features" text="Features" />
                            <FooterLink href="/locations" text="Locations" />
                            <FooterLink href="/download" text="Mobile App" />
                            <FooterLink href="/demo" text="Request Demo" badge="Live" />
                        </ul>
                    </div>

                    {/* COLUMN 3: RESOURCES */}
                    <div>
                        <h4 className="font-bold text-white mb-6">Resources</h4>
                        <ul className="space-y-4 text-sm">
                            <FooterLink href="/resources" text="Blog & Guides" />
                            <FooterLink href="/help" text="Help Center" />
                            <FooterLink href="/tools/roi-calculator" text="ROI Calculator" />
                            <FooterLink href="/compliance" text="Fair Workweek" />
                            <FooterLink href="/status" text="System Status" />
                        </ul>
                    </div>

                    {/* COLUMN 4: COMPANY */}
                    <div>
                        <h4 className="font-bold text-white mb-6">Company</h4>
                        <ul className="space-y-4 text-sm">
                            <FooterLink href="/about" text="About Us" />
                            <FooterLink href="/careers" text="Careers" />
                            <FooterLink href="/contact" text="Contact Support" />
                            <FooterLink href="/partners" text="Partnerships" />
                            <FooterLink href="/auth/login" text="Manager Login" highlight />
                        </ul>
                    </div>

                </div>
            </div>

            {/* --- BOTTOM SECTION: LEGAL & META --- */}
            <div className="border-t border-slate-900 bg-slate-950/50">
                <div className="container mx-auto px-6 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">

                        <div className="flex flex-col md:flex-row gap-4 md:gap-8 text-center md:text-left">
                            <p>© {currentYear} Workers Hive Inc.</p>
                            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                            <Link href="/security" className="hover:text-white transition-colors">Security</Link>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                <span className="font-medium text-slate-300">All Systems Operational</span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </footer>
    );
}

// --- SUB COMPONENTS ---

function FooterLink({ href, text, badge, highlight }: { href: string, text: string, badge?: string, highlight?: boolean }) {
    return (
        <li>
            <Link
                href={href}
                className={`flex items-center gap-2 transition-colors ${highlight ? 'text-white font-medium hover:text-red-500' : 'hover:text-white'}`}
            >
                {text}
                {badge && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600/10 text-red-500 border border-red-600/20">
                        {badge}
                    </span>
                )}
            </Link>
        </li>
    );
}

function SocialIcon({ icon, href }: { icon: React.ReactNode, href: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-all border border-slate-800"
        >
            {icon}
        </a>
    );
}
