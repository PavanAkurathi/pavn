import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheck, Zap, Users, Smartphone, Clock, PieChart, Check } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { PRICING } from '@repo/config';

export const metadata: Metadata = {
    title: 'Features | Workers Hive',
    description: 'Explore the tools that make Workers Hive the operating system for modern hospitality.',
};

export default function FeaturesPage() {
    return (
        <div className="bg-white min-h-screen pb-24">
            {/* Hero */}
            <section className="bg-slate-900 text-white py-24 text-center px-6">
                <h1 className="text-4xl md:text-6xl font-extrabold mb-6">Built for the floor.</h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                    Every feature is designed to cut manager screen time and keep the restaurant running smoothly.
                </p>
            </section>

            {/* Feature Grid */}
            <section className="container mx-auto px-6 py-24">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
                    <Feature
                        icon={<Clock />}
                        title="Smart Scheduling"
                        desc="Drag-and-drop builder with auto-conflict detection. Copy shifts from previous weeks in seconds."
                    />
                    <Feature
                        icon={<ShieldCheck />}
                        title="Geofencing"
                        desc="GPS verification ensures staff can only clock in when they are physically at your venue."
                    />
                    <Feature
                        icon={<Smartphone />}
                        title="Worker App"
                        desc="Staff can swap shifts, view schedules, and chat with managers directly from their phone."
                    />
                    <Feature
                        icon={<Zap />}
                        title="Instant Notifications"
                        desc="Push notifications for schedule changes, open shifts, and clock-in reminders."
                    />
                    <Feature
                        icon={<Users />}
                        title="Labor Forecasting"
                        desc="See your labor cost percentage in real-time as you build the schedule."
                    />
                    <Feature
                        icon={<PieChart />}
                        title="Payroll Ready"
                        desc="Export timesheets directly to Gusto, ADP, or Quickbooks with one click."
                    />
                </div>
            </section>

            {/* CTA */}
            <section className="bg-slate-50 py-20 text-center">
                <h2 className="text-3xl font-bold mb-6">Ready to optimize your workforce?</h2>
                <Link href="/auth/signup">
                    <Button className="bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-8">
                        Start {PRICING.TRIAL_DAYS}-Day Free Trial
                    </Button>
                </Link>
            </section>
        </div>
    );
}

function Feature({ icon, title, desc }: { icon: any, title: string, desc: string }) {
    return (
        <div className="space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-slate-900">{title}</h3>
            <p className="text-slate-600 leading-relaxed">{desc}</p>
        </div>
    );
}
