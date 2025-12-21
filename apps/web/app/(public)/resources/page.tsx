import Link from 'next/link';
import { Metadata } from 'next';
import { Card } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';

export const metadata: Metadata = {
    title: 'Restaurant Management Resources | Workers Hive',
    description: 'Guides on labor laws, scheduling tips, and hospitality management best practices.',
};

const ARTICLES = [
    {
        id: 1,
        title: "The Hidden Cost of 'Clopenings'",
        excerpt: "Why back-to-back shifts are killing your retention rate and how to fix your roster logic.",
        category: "Scheduling",
        date: "Oct 12, 2024",
        readTime: "5 min read"
    },
    {
        id: 2,
        title: "Fair Work Week Laws: A Manager's Guide",
        excerpt: "Navigating predictive scheduling laws in NYC, Oregon, and Chicago without getting fined.",
        category: "Compliance",
        date: "Oct 08, 2024",
        readTime: "8 min read"
    },
    {
        id: 3,
        title: "5 Ways to Reduce Labor Cost Without Firing Staff",
        excerpt: "Optimization techniques for slow Tuesdays and handling the dinner rush efficiently.",
        category: "Operations",
        date: "Sep 28, 2024",
        readTime: "6 min read"
    },
    {
        id: 4,
        title: "Geofencing vs. Biometrics",
        excerpt: "Which time-tracking method is right for your high-volume venue?",
        category: "Tech",
        date: "Sep 15, 2024",
        readTime: "4 min read"
    }
];

export default function ResourcesPage() {
    return (
        <div className="min-h-screen bg-slate-50 pb-24">

            {/* Header */}
            <section className="bg-white border-b border-slate-200 py-20 px-6">
                <div className="container mx-auto text-center max-w-2xl">
                    <h1 className="text-4xl font-extrabold text-slate-900 mb-4">The Shift Log</h1>
                    <p className="text-lg text-slate-600">
                        Insights, strategies, and news for modern hospitality operators.
                    </p>
                </div>
            </section>

            {/* Featured Article Grid */}
            <section className="container mx-auto px-6 py-12">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {ARTICLES.map((article) => (
                        <Link key={article.id} href={`/resources/${article.id}`} className="group">
                            <Card className="h-full overflow-hidden hover:shadow-xl transition-shadow border-slate-200 flex flex-col bg-white">
                                <div className="aspect-video bg-slate-200 relative">
                                    {/* Placeholder for Article Image */}
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold bg-slate-100">
                                        {article.category}
                                    </div>
                                </div>
                                <div className="p-6 flex flex-col grow">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                                            {article.category}
                                        </Badge>
                                        <span className="text-xs text-slate-400">{article.readTime}</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-red-600 transition-colors">
                                        {article.title}
                                    </h2>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-4 grow">
                                        {article.excerpt}
                                    </p>
                                    <div className="text-xs font-bold text-slate-400 pt-4 border-t border-slate-100">
                                        {article.date}
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Newsletter CTA */}
            <section className="container mx-auto px-6">
                <div className="bg-slate-900 rounded-3xl p-10 md:p-16 text-center text-white relative overflow-hidden">
                    <div className="relative z-10 max-w-xl mx-auto">
                        <h2 className="text-3xl font-bold mb-4">Don't miss a shift.</h2>
                        <p className="text-slate-400 mb-8">
                            Get the latest labor laws and scheduling tips sent to your inbox bi-weekly.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            <button className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors">
                                Subscribe
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
