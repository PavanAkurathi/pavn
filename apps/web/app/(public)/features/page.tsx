import { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Zap, Users, Smartphone, Clock, PieChart } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { SUBSCRIPTION } from '@repo/config';

export const metadata: Metadata = {
    title: 'Features | Workers Hive',
    description: 'Explore the tools that help businesses manage workforce access, live shifts, mobile attendance, and approvals.',
};

export default function FeaturesPage() {
    return (
        <div className="bg-white min-h-screen pb-24">
            {/* Hero */}
            <section className="bg-slate-900 text-white py-24 text-center px-6">
                <h1 className="text-4xl md:text-6xl font-extrabold mb-6">Built for real shift operations.</h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                    Every feature is designed to reduce admin friction and keep scheduling, attendance, and approvals in one operating loop.
                </p>
            </section>

            {/* Feature Grid */}
            <section className="container mx-auto px-6 py-24">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
                    <Feature
                        icon={<Clock />}
                        title="Shift publishing"
                        desc="Build schedules, assign workers, and publish only when the plan is ready to go live."
                    />
                    <Feature
                        icon={<ShieldCheck />}
                        title="Geofenced attendance"
                        desc="Location checks help verify on-site clock-ins and give managers better attendance records."
                    />
                    <Feature
                        icon={<Smartphone />}
                        title="Worker App"
                        desc="Workers can view assigned shifts, see shift details, clock in and out, and request corrections from mobile."
                    />
                    <Feature
                        icon={<Users />}
                        title="Workforce access"
                        desc="Invite admins and managers separately from workers, then give workers mobile access through workforce setup and phone verification."
                    />
                    <Feature
                        icon={<Zap />}
                        title="Reviewable corrections"
                        desc="If attendance timing needs a fix, workers can request a correction and managers can review it before approval."
                    />
                    <Feature
                        icon={<PieChart />}
                        title="Reports and exports"
                        desc="Export schedules and timesheets when the business needs records, payroll support, or compliance history."
                    />
                </div>
            </section>

            {/* CTA */}
            <section className="bg-slate-50 py-20 text-center">
                <h2 className="text-3xl font-bold mb-6">Ready to run scheduling and attendance from one place?</h2>
                <Link href="/auth/signup">
                    <Button className="bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-8">
                        Start {SUBSCRIPTION.TRIAL_DAYS}-Day Free Trial
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
