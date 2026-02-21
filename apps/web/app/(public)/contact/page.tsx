import { Mail, Calendar, MessageSquare } from 'lucide-react';
import { APP_NAME, SUPPORT_EMAIL } from '@repo/config';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: `Contact | ${APP_NAME}`,
};

export default function ContactPage() {
    return (
        <div className="container mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold text-slate-900 mb-4 text-center">How can we help?</h1>
            <p className="text-lg text-slate-500 text-center mb-12 max-w-xl mx-auto">
                We're a small team and we respond to every message personally. Most emails get a reply within a few hours.
            </p>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                <div className="p-8 border border-slate-200 rounded-2xl text-center hover:shadow-lg transition">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-900">
                        <Mail className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Email Us</h3>
                    <p className="text-slate-500 mb-6">For support, billing, or general questions.</p>
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-red-600 font-bold hover:underline">
                        {SUPPORT_EMAIL}
                    </a>
                </div>

                <div className="p-8 border border-slate-200 rounded-2xl text-center hover:shadow-lg transition">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-900">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Book a Demo</h3>
                    <p className="text-slate-500 mb-6">See Workers Hive in action with a 15-minute walkthrough.</p>
                    <Link href="/demo" className="text-red-600 font-bold hover:underline">
                        Schedule a Call
                    </Link>
                </div>

                <div className="p-8 border border-slate-200 rounded-2xl text-center hover:shadow-lg transition">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-900">
                        <MessageSquare className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Help Center</h3>
                    <p className="text-slate-500 mb-6">Common questions about setup, billing, and features.</p>
                    <Link href="/help" className="text-red-600 font-bold hover:underline">
                        Browse FAQs
                    </Link>
                </div>
            </div>

            <div className="mt-16 text-center">
                <p className="text-sm text-slate-400">Based in Boston, MA · Serving hospitality venues across the Northeast</p>
            </div>
        </div>
    );
}
