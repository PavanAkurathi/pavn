import { Metadata } from 'next';
import { APP_NAME, SUPPORT_EMAIL, PRICING } from '@repo/config';
import Link from 'next/link';

export const metadata: Metadata = {
    title: `Help Center | ${APP_NAME}`,
};

export default function HelpPage() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Help Center</h1>
            <p className="text-lg text-slate-500 mb-12">
                Quick answers to common questions. Can't find what you need?{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-red-600 hover:underline">Email us</a> and we'll respond within a few hours.
            </p>

            <div className="space-y-6">
                <Section title="For Managers">
                    <FAQ
                        q="How much does Workers Hive cost?"
                        a={`$${PRICING.MONTHLY_PER_LOCATION}/month per location. Flat rate, unlimited staff. No per-user fees. No contracts. You get a ${PRICING.TRIAL_DAYS}-day free trial — no credit card required.`}
                    />
                    <FAQ
                        q="How do I add my team?"
                        a="You can invite workers by phone number from the web dashboard. They'll receive an SMS with a link to download the app and join your venue. You can also bulk-import your roster from a CSV or spreadsheet — just email it to us and we'll handle the setup."
                    />
                    <FAQ
                        q="How does the geofenced timeclock work?"
                        a="You set a location for your venue with an address. When a worker tries to clock in from the mobile app, we check their GPS coordinates against your venue's geofence. If they're within range, the clock-in is verified. If not, it's flagged for your review."
                    />
                    <FAQ
                        q="Can I manage multiple locations?"
                        a="Yes. Each location is a separate subscription ($30/mo each). You manage all locations from one dashboard. Workers can be assigned to shifts across any of your locations."
                    />
                    <FAQ
                        q="How do I export timesheets for payroll?"
                        a="Go to Reports → Timesheets in the web dashboard. Select a date range and export as CSV. The export includes worker name, shift date, clock-in/out times, total hours, and any flags or adjustments."
                    />
                    <FAQ
                        q="What happens if a worker clocks in from the wrong location?"
                        a="The clock-in is flagged with an 'out of geofence' warning. You'll see it highlighted in the timesheet view. You can approve it, reject it, or adjust the time manually."
                    />
                </Section>

                <Section title="For Workers">
                    <FAQ
                        q="Is the app free for workers?"
                        a="Yes. Workers never pay anything. The app is free on iOS and Android."
                    />
                    <FAQ
                        q="Can I see shifts from multiple jobs?"
                        a="Yes. If you work at multiple venues that use Workers Hive, you'll see all your shifts in one unified schedule. The app will also warn you if you have a scheduling conflict between venues."
                    />
                    <FAQ
                        q="How do I clock in?"
                        a="Open the app, go to your current shift, and tap 'Clock In.' The app will verify your GPS location against the venue's geofence. Make sure location services are enabled on your phone."
                    />
                    <FAQ
                        q="What if I need to request a time adjustment?"
                        a="If you forgot to clock out or your hours look wrong, tap the shift in your history and select 'Request Adjustment.' Your manager will review and approve or deny the change."
                    />
                    <FAQ
                        q="How do I set my availability?"
                        a="Go to Profile → Availability. You can mark days as available or unavailable for each venue you work at. Your manager will see this when building the schedule."
                    />
                </Section>

                <Section title="Account & Billing">
                    <FAQ
                        q="How do I cancel my subscription?"
                        a={`Email ${SUPPORT_EMAIL} or go to Settings → Billing in the web dashboard. Cancellation takes effect at the end of your current billing period. Your data is retained for 90 days in case you want to reactivate.`}
                    />
                    <FAQ
                        q="Do you offer annual billing?"
                        a="Not yet. We're keeping it simple with month-to-month billing during our launch period. No lock-in."
                    />
                    <FAQ
                        q="Can I delete my account?"
                        a={`Yes. Email ${SUPPORT_EMAIL} and we'll delete your account within 48 hours. Note that timesheet records are retained for 3 years per labor record-keeping requirements.`}
                    />
                </Section>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6 mt-12 first:mt-0">{title}</h2>
            <div className="space-y-4">{children}</div>
        </div>
    );
}

function FAQ({ q, a }: { q: string; a: string }) {
    return (
        <details className="group border border-slate-200 rounded-xl overflow-hidden">
            <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition font-medium text-slate-900">
                {q}
                <span className="text-slate-400 group-open:rotate-45 transition-transform text-xl ml-4">+</span>
            </summary>
            <div className="px-5 pb-5 text-slate-600 leading-relaxed">{a}</div>
        </details>
    );
}
