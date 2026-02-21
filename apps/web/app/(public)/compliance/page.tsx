import { Metadata } from 'next';
import { APP_NAME } from '@repo/config';
import { Shield, Clock, FileText, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
    title: `Fair Workweek Compliance | ${APP_NAME}`,
    description: 'How Workers Hive helps hospitality venues stay compliant with Fair Workweek, predictive scheduling, and labor laws.',
};

export default function CompliancePage() {
    return (
        <div className="max-w-4xl mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Fair Workweek &amp; Labor Compliance</h1>
            <p className="text-lg text-slate-500 mb-12">
                Predictive scheduling laws are expanding across the country. Here's what hospitality operators need to know — and how {APP_NAME} helps you stay ahead.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-16">
                <ComplianceCard
                    icon={<Clock className="w-6 h-6" />}
                    title="Advance Notice"
                    description="Many cities require 10-14 days advance notice for schedules. Workers Hive timestamps every schedule publish so you have proof of compliance."
                />
                <ComplianceCard
                    icon={<AlertTriangle className="w-6 h-6" />}
                    title="Predictability Pay"
                    description="Last-minute schedule changes may trigger premium pay. Our shift change audit trail tracks every modification with timestamps."
                />
                <ComplianceCard
                    icon={<FileText className="w-6 h-6" />}
                    title="Record Keeping"
                    description="GPS-verified timesheets with geofence data give you defensible records for wage and hour audits. Export anytime as CSV."
                />
                <ComplianceCard
                    icon={<Shield className="w-6 h-6" />}
                    title="Right to Rest"
                    description="Some jurisdictions require minimum rest between closing and opening shifts. Our conflict detection flags clopening violations automatically."
                />
            </div>

            <div className="prose prose-slate prose-lg max-w-none">
                <h2>Cities with Fair Workweek Laws</h2>
                <p>
                    The following cities and states have enacted predictive scheduling or Fair Workweek laws that affect hospitality and food service employers. Requirements vary by jurisdiction — this is an overview, not legal advice.
                </p>

                <div className="not-prose overflow-x-auto mb-8">
                    <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="text-left p-4 font-bold text-slate-900">Jurisdiction</th>
                                <th className="text-left p-4 font-bold text-slate-900">Advance Notice</th>
                                <th className="text-left p-4 font-bold text-slate-900">Industries</th>
                                <th className="text-left p-4 font-bold text-slate-900">Employer Size</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            <ComplianceRow city="New York City" notice="14 days" industries="Fast food, retail" size="Chains with 30+ locations" />
                            <ComplianceRow city="San Francisco" notice="14 days" industries="Retail, food service" size="40+ employees (formula retail)" />
                            <ComplianceRow city="Seattle" notice="14 days" industries="Food service, retail, hospitality" size="500+ worldwide" />
                            <ComplianceRow city="Chicago" notice="14 days" industries="Hospitality, food service, healthcare, retail, warehouse, manufacturing, building services" size="100+ employees" />
                            <ComplianceRow city="Philadelphia" notice="14 days" industries="Food service, retail, hospitality" size="250+ employees & 30+ locations" />
                            <ComplianceRow city="Oregon (statewide)" notice="14 days" industries="Food service, retail, hospitality" size="500+ worldwide" />
                            <ComplianceRow city="Los Angeles" notice="14 days" industries="Retail" size="300+ employees" />
                        </tbody>
                    </table>
                </div>

                <p className="text-sm text-slate-500">
                    This table is for informational purposes only and may not reflect the most current requirements. Consult a qualified employment attorney for compliance advice specific to your jurisdiction.
                </p>

                <h2>How Workers Hive Helps</h2>
                <p>
                    Every schedule publish, shift change, and timesheet is timestamped and stored. If you need to prove you gave 14 days notice, export your shift history. If you need to show a worker was on-site, pull the GPS-verified clock-in record. If an auditor asks for 6 months of timesheets, export them in one click.
                </p>
                <p>
                    We don't replace a lawyer — but we give you the data trail that makes compliance straightforward.
                </p>
            </div>

            <div className="mt-12 text-center">
                <Link href="/auth/signup">
                    <button className="h-12 px-8 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all">
                        Start Free Trial
                    </button>
                </Link>
            </div>
        </div>
    );
}

function ComplianceCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
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

function ComplianceRow({ city, notice, industries, size }: { city: string; notice: string; industries: string; size: string }) {
    return (
        <tr>
            <td className="p-4 font-medium text-slate-900">{city}</td>
            <td className="p-4 text-slate-600">{notice}</td>
            <td className="p-4 text-slate-600">{industries}</td>
            <td className="p-4 text-slate-600">{size}</td>
        </tr>
    );
}
