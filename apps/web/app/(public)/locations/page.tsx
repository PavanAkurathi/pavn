import Link from 'next/link';
import { Metadata } from 'next';
import { MapPin, ArrowRight, ShieldCheck, Globe, Building2 } from 'lucide-react';
import { Card } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';

export const metadata: Metadata = {
    title: 'Restaurant Scheduling Software by City | Workers Hive',
    description: 'Compliant workforce management for hospitality groups in Boston, Miami, Austin, and nationwide. Fair Workweek ready.',
};

// Phase 1 Focus: Compliance & Usage, not "Worker Counts"
const CITIES = [
    {
        name: 'Boston, MA',
        slug: 'boston',
        tag: 'High Density',
        desc: 'Optimized for dense urban geofencing.'
    },
    {
        name: 'New York, NY',
        slug: 'nyc',
        tag: 'Fair Workweek Ready',
        desc: 'Predictive scheduling compliance tools.'
    },
    {
        name: 'Miami, FL',
        slug: 'miami',
        tag: 'Resort Ready',
        desc: 'Multi-venue resort management.'
    },
    {
        name: 'Austin, TX',
        slug: 'austin',
        tag: 'Event Focus',
        desc: 'Ideal for caterers and event halls.'
    },
    {
        name: 'Chicago, IL',
        slug: 'chicago',
        tag: 'Fair Workweek Ready',
        desc: 'Compliance for >30 employee venues.'
    },
    {
        name: 'Los Angeles, CA',
        slug: 'la',
        tag: 'Break Laws',
        desc: 'California break penalty tracking.'
    },
];

export default function LocationsPage() {
    return (
        <div className="min-h-screen bg-white pb-24">

            {/* --- HERO: SaaS Focus --- */}
            <section className="bg-slate-50 border-b border-slate-200 py-24 px-6">
                <div className="container mx-auto text-center max-w-3xl">
                    <div className="inline-flex items-center justify-center p-3 bg-white rounded-xl shadow-sm mb-8 border border-slate-100">
                        <Globe className="w-6 h-6 text-slate-900" />
                    </div>
                    <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
                        One Platform. <br />
                        <span className="text-red-600">Every Location.</span>
                    </h1>
                    <p className="text-xl text-slate-600 leading-relaxed">
                        Whether you run a single café in Austin or a restaurant group across three time zones,
                        Workers Hive keeps your roster in sync and your labor costs under control.
                    </p>
                </div>
            </section>

            {/* --- VALUE PROP: Why Location Matters for SaaS --- */}
            <section className="container mx-auto px-6 py-16">
                <div className="grid md:grid-cols-3 gap-8 mb-16">
                    <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <ShieldCheck className="w-10 h-10 text-red-600 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Local Compliance</h3>
                        <p className="text-slate-500">
                            We help you stay compliant with city-specific "Fair Workweek" laws, break mandates, and overtime calculations.
                        </p>
                    </div>
                    <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <MapPin className="w-10 h-10 text-slate-900 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Precise Geofencing</h3>
                        <p className="text-slate-500">
                            Our GPS technology is tuned for dense urban environments, ensuring staff can't clock in from the parking lot.
                        </p>
                    </div>
                    <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <Building2 className="w-10 h-10 text-slate-900 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Multi-Unit View</h3>
                        <p className="text-slate-500">
                            Switch between locations in one click. View labor costs across your entire portfolio in a single dashboard.
                        </p>
                    </div>
                </div>
            </section>

            {/* --- CITY GRID --- */}
            <section className="bg-slate-900 py-24 text-white">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Supported Markets</h2>
                            <p className="text-slate-400">Venues in these cities use Workers Hive to manage operations.</p>
                        </div>
                        <Link href="/auth/signup">
                            <button className="text-sm font-bold text-white border-b border-red-500 pb-1 hover:text-red-400 transition-colors">
                                Add Your City →
                            </button>
                        </Link>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {CITIES.map((city) => (
                            <Link key={city.slug} href={`/locations/${city.slug}`} className="group">
                                <Card className="h-full p-6 bg-slate-800 border-slate-700 hover:bg-slate-700 transition-all hover:border-red-500/50 group-hover:-translate-y-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <Badge variant="outline" className="bg-slate-900/50 text-slate-300 border-slate-600 group-hover:border-red-500/50 group-hover:text-red-400">
                                            {city.tag}
                                        </Badge>
                                        <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
                                    </div>

                                    <h3 className="text-xl font-bold text-white mb-2">{city.name}</h3>
                                    <p className="text-sm text-slate-400 font-medium">
                                        {city.desc}
                                    </p>
                                </Card>
                            </Link>
                        ))}
                    </div>

                    <div className="mt-12 text-center">
                        <p className="text-slate-500 text-sm">
                            Don't see your city? Workers Hive works globally.
                            <span className="text-slate-400 ml-1">Timezones are handled automatically.</span>
                        </p>
                    </div>
                </div>
            </section>

        </div>
    );
}
