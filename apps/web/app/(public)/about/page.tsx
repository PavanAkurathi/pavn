import { Metadata } from 'next';
import { APP_NAME } from '@repo/config';

export const metadata: Metadata = {
    title: `About Us | ${APP_NAME}`,
};

export default function AboutPage() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Built by someone who's worked every shift.</h1>
            <p className="text-lg text-slate-500 mb-12">
                18 years in hospitality. Server, bartender, event coordinator, staffing operator. Now building the tool I never had.
            </p>

            <div className="prose prose-slate prose-lg max-w-none">
                <p>
                    I've worked the floor at premium venues across Boston — from Longwood Venues to Raffles Hotels to Boston University's Aramark dining operations. I know what it feels like to get a call at 6am asking you to cover a shift. I know what it's like to manage a roster of 60 workers across three states and still have no idea who's available Friday night.
                </p>

                <p>
                    In 2023, I started Workers Hive as a staffing service. I built a network of trusted hospitality professionals across Massachusetts, Rhode Island, and Maine. We served enterprise clients, generated real revenue, and proved the model works. Then I watched a VC-backed platform come in and undercut us — not because they were better, but because they had software and we had spreadsheets.
                </p>

                <p>
                    That's when I decided to build the software myself.
                </p>

                <p>
                    Workers Hive isn't another scheduling app built by engineers who've never plated a dish. It's built by someone who's been on both sides — working the shifts AND managing the schedule. I know what breaks in the real world because I've lived it for nearly two decades.
                </p>

                <h2>Why Hospitality Deserves Better</h2>

                <p>
                    The scheduling tools on the market today were built for desk workers and retrofitted for hospitality. They charge per-user fees that punish you for hiring seasonal staff. They don't understand that your workers work at three different venues. They don't know that a bartender at Longwood on Saturday might be a server at a Cambridge restaurant on Sunday.
                </p>

                <p>
                    Workers Hive is the first scheduling platform designed for how hospitality actually works — where workers have multiple employers, where team sizes change weekly, and where a no-show at 4pm means someone just worked a double they didn't plan on.
                </p>

                <h2>The Mission</h2>

                <p>
                    Give every hospitality venue access to professional-grade workforce tools at a price that doesn't scale with headcount. Give every worker a single app that shows all their shifts, across all their jobs, with no double-bookings.
                </p>

                <p>
                    We're based in Boston and we're just getting started.
                </p>
            </div>
        </div>
    );
}
