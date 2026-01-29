import Link from 'next/link';
import { Metadata } from 'next';
import { Check, HelpCircle } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { FAQ } from '@/components/landing/faq';

export const metadata: Metadata = {
    title: 'Pricing | Workers Hive',
    description: 'Simple flat-rate pricing for restaurant scheduling. $25/month per location. Unlimited staff included.',
};

export default function PricingPage() {
    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "PriceSpecification",
                        "price": "25.00",
                        "priceCurrency": "USD",
                        "unitCode": "MON",
                        "name": "The Hive Plan",
                        "description": "Unlimited staff, geofenced timeclock, and scheduling for one location."
                    })
                }}
            />

            {/* Header */}
            <section className="bg-slate-900 text-white pt-24 pb-32 text-center px-6">
                <h1 className="text-4xl md:text-6xl font-extrabold mb-6">One Plan. Unlimited Growth.</h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                    We don't believe in per-user fees. Run your entire venue for less than the cost of one dinner shift.
                </p>
            </section>

            {/* Pricing Card */}
            <section className="container mx-auto px-6 -mt-20">
                <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 relative">

                    <div className="absolute top-0 w-full h-2 bg-linear-to-r from-red-600 to-red-400"></div>

                    <div className="p-10 text-center border-b border-slate-100">
                        <h3 className="text-xl font-bold text-slate-500 uppercase tracking-widest mb-4">The Hive Plan</h3>
                        <div className="flex justify-center items-baseline gap-2 mb-2">
                            <span className="text-6xl font-extrabold text-slate-900">$25</span>
                            <span className="text-xl text-slate-500 font-medium">/month</span>
                        </div>
                        <p className="text-slate-400 text-sm">Per location. Billed monthly.</p>
                    </div>

                    <div className="p-10 bg-slate-50/50">
                        <ul className="space-y-4 mb-8">
                            <PricingFeature text="Unlimited Staff Members" />
                            <PricingFeature text="Geofenced Timeclock" />
                            <PricingFeature text="Drag & Drop Scheduling" />
                            <PricingFeature text="Payroll Exports (CSV)" />
                            <PricingFeature text="Mobile App for Workers" />
                        </ul>

                        <Link href="/auth/signup">
                            <Button className="w-full h-14 text-lg font-bold bg-red-600 hover:bg-red-700 shadow-xl shadow-red-600/20">
                                Start 14-Day Free Trial
                            </Button>
                        </Link>
                        <p className="text-xs text-center text-slate-400 mt-4">No credit card required for trial.</p>
                    </div>
                </div>
            </section>

            {/* FAQ Reuse */}
            <div className="mt-20">
                <FAQ />
            </div>
        </div>
    );
}

function PricingFeature({ text }: { text: string }) {
    return (
        <li className="flex items-center gap-3 text-slate-700 font-medium">
            <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" />
            </div>
            {text}
        </li>
    );
}
