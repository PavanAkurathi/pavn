import { ROICalculator } from '@/components/landing/roi-calculator';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Scheduling ROI Calculator | Workers Hive',
    description: 'Calculate how much you can save by switching to flat-rate scheduling.',
};

export default function ROIPage() {
    return (
        <div className="bg-white min-h-screen pt-20">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-slate-900">Savings Calculator</h1>
                <p className="text-slate-500 mt-2">See the difference flat-rate pricing makes.</p>
            </div>
            <ROICalculator />
        </div>
    );
}
