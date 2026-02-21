import { Metadata } from 'next';
import { APP_NAME, SUPPORT_EMAIL } from '@repo/config';
import { Smartphone, Apple, Play } from 'lucide-react';

export const metadata: Metadata = {
    title: `Download the App | ${APP_NAME}`,
};

export default function DownloadPage() {
    return (
        <div className="container mx-auto px-6 py-24 text-center">
            <div className="max-w-2xl mx-auto">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-8">
                    <Smartphone className="w-8 h-8 text-slate-700" />
                </div>

                <h1 className="text-4xl font-bold text-slate-900 mb-4">Get the Workers Hive App</h1>
                <p className="text-lg text-slate-500 mb-12">
                    Clock in with GPS verification, view your shifts across all your jobs, and manage your availability — all from your phone.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                    <div className="flex items-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-xl">
                        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                        <div className="text-left">
                            <p className="text-xs text-slate-400">Coming soon on</p>
                            <p className="text-lg font-bold">App Store</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-xl">
                        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.04c.68 0 1.26-.24 1.8-.72L21 12l-16.02-10.32c-.54-.48-1.12-.72-1.8-.72C2.07.96 1.2 1.92 1.2 3.12V20.88c0 1.2.87 2.16 1.98 2.16z"/></svg>
                        <div className="text-left">
                            <p className="text-xs text-slate-400">Coming soon on</p>
                            <p className="text-lg font-bold">Google Play</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8">
                    <h3 className="font-bold text-slate-900 mb-2">Want early access?</h3>
                    <p className="text-slate-500 mb-4">
                        We're onboarding venues now. Email us your venue name and we'll get you set up with direct app access.
                    </p>
                    <a
                        href={`mailto:${SUPPORT_EMAIL}?subject=Early Access - Workers Hive App&body=Venue name:%0ACity:%0ANumber of staff:`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition"
                    >
                        Request Early Access
                    </a>
                </div>

                <div className="mt-12 text-sm text-slate-400">
                    <p>Requires iOS 15+ or Android 10+. Location services required for GPS clock-in.</p>
                </div>
            </div>
        </div>
    );
}
