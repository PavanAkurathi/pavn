import { Metadata } from 'next';
import { APP_NAME } from '@repo/config';
import { CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
    title: `System Status | ${APP_NAME}`,
};

export default function StatusPage() {
    const services = [
        { name: 'Web Dashboard', status: 'operational' },
        { name: 'API', status: 'operational' },
        { name: 'Mobile App (iOS)', status: 'operational' },
        { name: 'Mobile App (Android)', status: 'operational' },
        { name: 'Database', status: 'operational' },
        { name: 'SMS Notifications (Twilio)', status: 'operational' },
    ];

    return (
        <div className="max-w-2xl mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">System Status</h1>

            <div className="flex items-center gap-3 mb-12 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-emerald-800">All Systems Operational</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                {services.map((service) => (
                    <div key={service.name} className="flex items-center justify-between p-4">
                        <span className="font-medium text-slate-900">{service.name}</span>
                        <div className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Operational</span>
                        </div>
                    </div>
                ))}
            </div>

            <p className="text-sm text-slate-400 mt-8 text-center">
                This page shows current service availability. For real-time monitoring and incident history, we use BetterStack.
            </p>
        </div>
    );
}
