import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'About Us | Workers Hive',
};

export default function AboutPage() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold text-slate-900 mb-8">We built the tool we needed.</h1>
            <div className="prose prose-lg text-slate-600">
                <p>
                    Workers Hive started in a busy Boston restaurant basement. We were tired of calling 20 people to fill one shift. We were tired of paying exorbitant fees for software that barely worked.
                </p>
                <p>
                    We realized that the hospitality industry didn't need another complex enterprise system. It needed a <strong>network</strong>.
                </p>
                <p>
                    Today, we help venues across the country manage their workforce with transparency, fairness, and speed.
                </p>
            </div>
        </div>
    );
}
