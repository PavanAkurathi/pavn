import { Metadata } from 'next';
import { APP_NAME, SUPPORT_EMAIL, SUBSCRIPTION } from '@repo/config';

export const metadata: Metadata = {
    title: `Terms of Service | ${APP_NAME}`,
};

export default function TermsPage() {
    const lastUpdated = 'February 20, 2026';

    return (
        <div className="max-w-3xl mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Terms of Service</h1>
            <p className="text-sm text-slate-500 mb-12">Last updated: {lastUpdated}</p>

            <div className="prose prose-slate prose-lg max-w-none">
                <p>
                    These Terms of Service ("Terms") govern your use of the {APP_NAME} platform, including our website at workershive.com and our mobile applications (collectively, the "Service"). By using the Service, you agree to these Terms.
                </p>

                <h2>1. The Service</h2>
                <p>
                    {APP_NAME} provides a cloud-based workforce scheduling and time-tracking platform for the hospitality industry. The Service includes shift scheduling, GPS-verified clock-in/out, timesheet management, availability tracking, and related tools for venue managers ("Managers") and hospitality workers ("Workers").
                </p>

                <h2>2. Accounts</h2>
                <p>
                    You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 16 years old to use the Service. Manager accounts require a valid business email and venue information.
                </p>

                <h2>3. Subscription and Payment</h2>
                <p>
                    Manager accounts are billed on a monthly subscription basis at the current rate (${SUBSCRIPTION.MONTHLY_PRICE_USD}/month per location at time of writing). New accounts receive a {SUBSCRIPTION.TRIAL_DAYS}-day free trial. You may cancel your subscription at any time and will retain access through the end of your current billing period. We do not offer refunds for partial months.
                </p>
                <p>
                    Worker accounts are free. Workers are not charged for any use of the Service.
                </p>

                <h2>4. Employment Relationship</h2>
                <p>
                    <strong>{APP_NAME} is not an employer, staffing agency, or employment intermediary.</strong> We provide scheduling software only. The employment relationship exists solely between the Manager (venue) and the Worker. We do not set wages, control work conditions, provide benefits, or make hiring/firing decisions. Managers are responsible for compliance with all applicable labor laws in their jurisdiction.
                </p>

                <h2>5. Location Data and Geofencing</h2>
                <p>
                    The Service uses GPS location data to verify worker presence during clock-in and clock-out events. By using the clock-in/out feature, Workers consent to the collection of their GPS coordinates at those specific moments. Location data is only collected at the time of clock-in and clock-out — the Service does not track location continuously. Workers may revoke location permissions at any time through their device settings, which will prevent them from using geofenced clock-in/out.
                </p>

                <h2>6. Data and Timesheets</h2>
                <p>
                    Managers own their venue data, shift schedules, and timesheet records. Workers own their personal profile data. We store and process this data solely to provide the Service. Timesheet records are retained for 3 years after account deletion to support labor record-keeping compliance. Managers can export their data at any time.
                </p>

                <h2>7. Acceptable Use</h2>
                <p>You agree not to:</p>
                <ul>
                    <li>Use the Service to violate any applicable law or regulation</li>
                    <li>Attempt to falsify location data or clock-in/out records</li>
                    <li>Share account credentials with unauthorized users</li>
                    <li>Use automated tools to access the Service without our written permission</li>
                    <li>Attempt to reverse-engineer, decompile, or extract source code from the Service</li>
                </ul>

                <h2>8. Service Availability</h2>
                <p>
                    We strive to maintain high availability but do not guarantee uninterrupted access. We may perform maintenance with reasonable advance notice. We are not liable for downtime or data loss resulting from circumstances beyond our reasonable control.
                </p>

                <h2>9. Limitation of Liability</h2>
                <p>
                    To the maximum extent permitted by law, {APP_NAME} shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunity, arising from your use of the Service. Our total liability for any claim arising from these Terms shall not exceed the amount you paid us in the 12 months preceding the claim.
                </p>

                <h2>10. Termination</h2>
                <p>
                    Either party may terminate the agreement at any time. You can cancel your subscription through the Service or by contacting {SUPPORT_EMAIL}. We may suspend or terminate accounts that violate these Terms. Upon termination, your right to use the Service ceases, but data retention provisions in Section 6 still apply.
                </p>

                <h2>11. Changes to Terms</h2>
                <p>
                    We may update these Terms from time to time. We will notify you of material changes via email or in-app notification at least 30 days before they take effect. Continued use of the Service after changes become effective constitutes acceptance of the updated Terms.
                </p>

                <h2>12. Governing Law</h2>
                <p>
                    These Terms are governed by the laws of the Commonwealth of Massachusetts, without regard to conflict of law principles.
                </p>

                <h2>13. Contact</h2>
                <p>
                    Questions about these Terms? Contact us at{' '}
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-red-600 hover:underline">{SUPPORT_EMAIL}</a>.
                </p>
            </div>
        </div>
    );
}
