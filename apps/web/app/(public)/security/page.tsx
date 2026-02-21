import { Metadata } from 'next';
import { APP_NAME, SUPPORT_EMAIL } from '@repo/config';
import { Shield, Lock, Database, Eye } from 'lucide-react';

export const metadata: Metadata = {
    title: `Security | ${APP_NAME}`,
};

export default function SecurityPage() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Security</h1>
            <p className="text-lg text-slate-500 mb-12">
                We handle sensitive data — worker locations, schedules, and timesheets. Here's how we protect it.
            </p>

            <div className="grid sm:grid-cols-2 gap-6 mb-16">
                <SecurityCard
                    icon={<Lock className="w-6 h-6" />}
                    title="Encryption in Transit"
                    description="All data transmitted between your devices and our servers is encrypted using TLS 1.2+. API endpoints enforce HTTPS-only connections."
                />
                <SecurityCard
                    icon={<Database className="w-6 h-6" />}
                    title="Encryption at Rest"
                    description="Your data is stored in PostgreSQL databases hosted on Railway with encrypted storage volumes. Daily automated backups with point-in-time recovery."
                />
                <SecurityCard
                    icon={<Shield className="w-6 h-6" />}
                    title="Authentication"
                    description="Phone-based OTP authentication via Twilio. Session tokens are short-lived and scoped to your organization. No passwords stored."
                />
                <SecurityCard
                    icon={<Eye className="w-6 h-6" />}
                    title="Access Control"
                    description="Role-based permissions ensure managers can only access their own venue's data. Workers can only see their own shifts and timesheets. Organization boundaries are enforced at the API level."
                />
            </div>

            <div className="prose prose-slate prose-lg max-w-none">
                <h2>Infrastructure</h2>
                <p>
                    Our application runs on Railway's managed infrastructure, which provides isolated container environments, automated scaling, and built-in DDoS protection. Our database uses PostgreSQL with the PostGIS extension for geospatial queries (geofencing).
                </p>

                <h2>Location Data</h2>
                <p>
                    GPS coordinates are collected only at clock-in and clock-out events. We do not track worker location continuously or in the background. Location data is stored alongside the timesheet record and is only visible to the worker and their assigned manager.
                </p>

                <h2>Error Monitoring</h2>
                <p>
                    We use Sentry for application error monitoring. Error reports may include request metadata but do not include GPS coordinates, personal information, or authentication tokens.
                </p>

                <h2>Reporting a Vulnerability</h2>
                <p>
                    If you discover a security vulnerability, please report it to{' '}
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-red-600 hover:underline">{SUPPORT_EMAIL}</a>{' '}
                    with the subject line "Security Report." We take all reports seriously and will respond within 48 hours.
                </p>
            </div>
        </div>
    );
}

function SecurityCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-6 border border-slate-200 rounded-xl">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700 mb-4">
                {icon}
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-2">{title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
        </div>
    );
}
