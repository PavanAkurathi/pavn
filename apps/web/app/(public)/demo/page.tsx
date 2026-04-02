import { Metadata } from 'next';
import { APP_NAME, SUPPORT_EMAIL } from '@repo/config';
import { MonitorPlay, Clock, Users } from 'lucide-react';
import Link from 'next/link';
import { MarketingHeading } from '@/components/marketing/marketing-heading';

export const metadata: Metadata = {
    title: `Request a Demo | ${APP_NAME}`,
};

export default function DemoPage() {
    return (
        <div className="container mx-auto px-6 py-24">
            <div className="max-w-3xl mx-auto text-center mb-16">
                <MarketingHeading
                    as="h1"
                    align="center"
                    title="See Workers Hive"
                    accent="in action"
                    description="15 minutes. We’ll walk you through scheduling, workforce access, geofenced clock-in, and timesheet review tailored to your operation."
                    className="max-w-3xl"
                    descriptionClassName="max-w-2xl text-slate-500"
                />
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-16">
                <div className="text-center p-6">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="font-bold mb-1">15 Minutes</h3>
                    <p className="text-sm text-slate-500">Quick, focused walkthrough. No hour-long sales pitch.</p>
                </div>
                <div className="text-center p-6">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <MonitorPlay className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="font-bold mb-1">Live Product</h3>
                    <p className="text-sm text-slate-500">Not slides — we'll show you the real app with your use case.</p>
                </div>
                <div className="text-center p-6">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Users className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="font-bold mb-1">Free Setup</h3>
                    <p className="text-sm text-slate-500">If you sign up, we help import your workforce and first location. No messy setup required.</p>
                </div>
            </div>

            <div className="max-w-xl mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
                <MarketingHeading
                    title="Book your"
                    accent="demo"
                    align="center"
                    size="subsection"
                    className="mb-4"
                    descriptionClassName="max-w-xl"
                />
                <p className="text-slate-500 mb-6">
                    Send us your business details and preferred time. We’ll confirm within a few hours.
                </p>
                <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=Demo Request - Workers Hive&body=Hi,%0A%0AI'd like to schedule a demo.%0A%0AVenue name:%0ACity:%0ANumber of staff:%0APreferred day/time:%0A%0AThanks!`}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition text-lg"
                >
                    Request Demo
                </a>
                <p className="text-xs text-slate-400 mt-4">
                    Or email us directly at {SUPPORT_EMAIL}
                </p>
            </div>

            <div className="max-w-xl mx-auto text-center mt-12">
                <p className="text-slate-500">
                    Rather explore on your own?{' '}
                    <Link href="/auth/signup" className="text-red-600 font-bold hover:underline">
                        Start your free trial
                    </Link>{' '}
                    — no credit card required.
                </p>
            </div>
        </div>
    );
}
