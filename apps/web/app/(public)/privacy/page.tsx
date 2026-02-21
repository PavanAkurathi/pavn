import { Metadata } from 'next';
import { APP_NAME, SUPPORT_EMAIL } from '@repo/config';

export const metadata: Metadata = {
    title: `Privacy Policy | ${APP_NAME}`,
};

export default function PrivacyPage() {
    const lastUpdated = 'February 20, 2026';

    return (
        <div className="max-w-3xl mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Privacy Policy</h1>
            <p className="text-sm text-slate-500 mb-12">Last updated: {lastUpdated}</p>

            <div className="prose prose-slate prose-lg max-w-none">
                <p>
                    {APP_NAME} ("we", "us", "our") operates the workershive.com website and the Workers Hive mobile application. This page informs you of our policies regarding the collection, use, and disclosure of personal information when you use our service.
                </p>

                <h2>Information We Collect</h2>

                <h3>Account Information</h3>
                <p>
                    When you create an account, we collect your name, email address, phone number, and role (manager or worker). For managers, we also collect your venue name and business address.
                </p>

                <h3>Location Data</h3>
                <p>
                    Our mobile app collects GPS location data <strong>only when you clock in or clock out</strong> of a shift. This data is used to verify that workers are physically present at the venue (geofenced timeclock). We do not track location continuously or in the background. Location data is associated with the specific clock-in/clock-out event and stored alongside the timesheet record.
                </p>

                <h3>Shift and Schedule Data</h3>
                <p>
                    We store shift schedules, timesheet records, availability preferences, and assignment history. For workers who work at multiple venues through our platform, we aggregate shift data across employers to provide a unified schedule view and detect scheduling conflicts.
                </p>

                <h3>Device Information</h3>
                <p>
                    We collect device type, operating system, and push notification tokens to deliver shift reminders and schedule updates.
                </p>

                <h2>How We Use Your Information</h2>
                <p>We use the information we collect to:</p>
                <ul>
                    <li>Provide, maintain, and improve our scheduling and timekeeping services</li>
                    <li>Verify worker presence at venues via GPS geofencing during clock-in and clock-out</li>
                    <li>Send shift reminders, schedule changes, and service notifications via SMS and push notifications</li>
                    <li>Generate timesheets and reports for managers</li>
                    <li>Detect and alert on scheduling conflicts across multiple employers</li>
                    <li>Provide customer support</li>
                </ul>

                <h2>Information Sharing</h2>
                <p>We share personal information only in the following circumstances:</p>
                <ul>
                    <li><strong>Between managers and their workers:</strong> Managers can see shift assignments, clock-in/out times, and location verification status for workers assigned to their venue.</li>
                    <li><strong>Service providers:</strong> We use Twilio for SMS delivery, Railway for hosting, and Sentry for error monitoring. These providers process data on our behalf under contractual obligations.</li>
                    <li><strong>Legal requirements:</strong> We may disclose information if required by law or in response to valid legal process.</li>
                </ul>
                <p>We do not sell personal information to third parties. We do not serve advertising.</p>

                <h2>Data Retention</h2>
                <p>
                    We retain account information and timesheet records for as long as your account is active, plus 3 years after account deletion to comply with labor record-keeping requirements. You can request deletion of your account by emailing {SUPPORT_EMAIL}.
                </p>

                <h2>Data Security</h2>
                <p>
                    We use industry-standard security measures including encrypted data transmission (TLS), encrypted data at rest, and role-based access controls. Our infrastructure is hosted on Railway with daily database backups.
                </p>

                <h2>Your Rights</h2>
                <p>You have the right to:</p>
                <ul>
                    <li>Access the personal information we hold about you</li>
                    <li>Request correction of inaccurate information</li>
                    <li>Request deletion of your account and associated data</li>
                    <li>Opt out of non-essential SMS notifications</li>
                    <li>Withdraw location permissions at any time through your device settings (note: this will prevent geofenced clock-in/out)</li>
                </ul>

                <h2>Children</h2>
                <p>Our service is not directed to anyone under 16. We do not knowingly collect information from children under 16.</p>

                <h2>Changes to This Policy</h2>
                <p>
                    We may update this policy from time to time. We will notify you of material changes via email or in-app notification before they take effect.
                </p>

                <h2>Contact Us</h2>
                <p>
                    If you have questions about this privacy policy, contact us at{' '}
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-red-600 hover:underline">{SUPPORT_EMAIL}</a>.
                </p>
            </div>
        </div>
    );
}
