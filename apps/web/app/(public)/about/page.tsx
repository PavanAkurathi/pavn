import { Metadata } from 'next';
import { APP_NAME } from '@repo/config';

export const metadata: Metadata = {
    title: `About Us | ${APP_NAME}`,
};

export default function AboutPage() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Built by someone who has worked the shifts and managed the roster.</h1>
            <p className="text-lg text-slate-500 mb-12">
                Hospitality was the starting point. The mission now is broader: build better operating software for shift-based teams.
            </p>

            <div className="prose prose-slate prose-lg max-w-none">
                <p>
                    I have worked the floor at premium venues across Boston, from Longwood events to hotel operations to university dining. I know what it feels like to get a call at 6am asking you to cover a shift. I know what it's like to manage a roster of 60 workers across multiple locations and still have no clean answer for who is available Friday night.
                </p>

                <p>
                    In 2023, I started Workers Hive as a staffing service. We built a trusted network, served real clients, and proved the operational pain was real. The part that kept breaking was not the people. It was the software gap around scheduling, attendance, and workforce coordination.
                </p>

                <p>
                    That's when I decided to build the software myself.
                </p>

                <p>
                    Workers Hive is not another generic scheduling app. It is built by someone who has been on both sides of the shift: doing the work and managing the schedule. The product is grounded in what actually breaks in real operations.
                </p>

                <h2>Why shift-based teams deserve better</h2>

                <p>
                    Too many scheduling tools were built for desk-heavy teams and then retrofitted for hourly work. They charge per-user fees that punish growth, hide attendance issues until after payroll, and make frontline operations feel like an afterthought.
                </p>

                <p>
                    Workers Hive started in hospitality because that is where the pain was most visible, but the same problems show up anywhere a business manages shifts, site attendance, and changing workforce coverage.
                </p>

                <h2>The Mission</h2>

                <p>
                    Give businesses professional-grade workforce tools at a price that does not scale with headcount. Give workers a clean mobile path into assigned shifts, attendance, and correction review.
                </p>

                <p>
                    We're based in Boston and we're just getting started.
                </p>
            </div>
        </div>
    );
}
