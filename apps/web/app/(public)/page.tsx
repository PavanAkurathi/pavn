import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';
import { Button } from '@repo/ui/components/ui/button';
import { PRICING } from '@repo/config';
import {
  Check,
  ArrowRight,
  MapPin,
  Star
} from 'lucide-react';

// --- COMPONENT IMPORTS ---
import { ROICalculator } from '@/components/landing/roi-calculator';
import { FeatureTabs } from '@/components/landing/feature-tabs';
import { ComparisonTable } from '@/components/landing/comparison-table';
import { FAQ } from '@/components/landing/faq';

export const metadata: Metadata = {
  title: 'Workers Hive | Smart Staff Scheduling',
  description: 'The easiest way to schedule your hospitality team. Build rosters, publish shifts, and track time in minutes.',
};

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background font-sans">

      {/* --- HERO SECTION --- */}
      <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden border-b border-border">
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

            {/* Left Content */}
            <div className="lg:w-1/2 space-y-8">
              <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-foreground">
                Scheduling made <br />
                <span className="text-destructive">effortless.</span>
              </h1>

              <p className="text-xl text-muted-foreground max-w-lg leading-relaxed font-medium">
                Stop wrestling with spreadsheets. Build rosters, publish shifts, and track time in minutes. The modern tool for modern venues.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/auth/signup" className="w-full sm:w-auto">
                  <button className="h-14 px-8 w-full rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-black/10">
                    Get Started Free <ArrowRight className="w-5 h-5" />
                  </button>
                </Link>
                <Link href="/demo" className="w-full sm:w-auto">
                  <button className="h-14 px-8 w-full rounded-xl border border-input bg-background text-foreground font-bold text-lg hover:bg-secondary/50 transition-all">
                    How it Works
                  </button>
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm text-muted-foreground font-medium pt-2">
                <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-600" /> No credit card required</span>
                <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-600" /> Cancel anytime</span>
              </div>
            </div>

            {/* Right Visual (The Shift Card) */}
            <div className="lg:w-1/2 relative w-full flex justify-center lg:justify-end">
              {/* Background Glow using Brand Red/Obsidian hints */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-linear-to-tr from-destructive/10 to-primary/5 rounded-full blur-3xl -z-10"></div>

              <div className="relative bg-card text-card-foreground p-6 rounded-2xl shadow-2xl border border-border w-full max-w-md transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-border">
                  <div>
                    <h3 className="text-lg font-bold">Dinner Service</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">5:00 PM - 11:00 PM</p>
                  </div>
                  <div className="bg-destructive text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse shadow-lg shadow-destructive/20">
                    LIVE NOW
                  </div>
                </div>

                {/* Staff Row 1 */}
                <div className="flex items-center gap-4 mb-4 bg-secondary/30 p-4 rounded-xl border border-border">
                  <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center font-bold text-foreground shadow-sm text-lg">SJ</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-foreground">Sarah Jenkins</p>
                      <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">ON SITE</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-green-600" /> Geofence Verified 4:55 PM
                    </p>
                  </div>
                </div>

                {/* Staff Row 2 */}
                <div className="flex items-center gap-4 bg-background p-4 rounded-xl border border-dashed border-input opacity-60">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-bold text-muted-foreground text-lg">MC</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-muted-foreground">Marcus Chen</p>
                      <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">SCHEDULED</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Shift starts in 15 mins</p>
                  </div>
                </div>

                <div className="mt-6 pt-4 flex justify-between items-center text-xs font-bold text-muted-foreground border-t border-border">
                  <span>ROSTER: 4/5 CHECKED IN</span>
                  <span>EST. LABOR: $420</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* --- 1. ROI CALCULATOR (Dark Mode, Fixed Slider) --- */}
      <ROICalculator />

      {/* --- 2. FEATURE DEEP DIVE (Interactive Tabs) --- */}
      <FeatureTabs />

      {/* --- 3. COMPARISON TABLE (Instawork Style) --- */}
      <ComparisonTable />



      {/* --- FAQ --- */}
      <FAQ />

      {/* --- FINAL CTA --- */}
      <section className="py-32 px-6 bg-slate-900 text-white relative overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white opacity-5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl lg:text-5xl font-extrabold mb-8 tracking-tight">
            Ready to upgrade your operations?
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth/signup">
              <button className="h-16 px-12 rounded-full bg-destructive text-white font-bold text-xl hover:bg-red-600 transition-all shadow-2xl shadow-red-900/50">
                Start {PRICING.TRIAL_DAYS}-Day Free Trial
              </button>
            </Link>
          </div>
          <p className="mt-6 text-slate-400 font-medium">
            Setup takes 5 minutes • Import your roster via CSV
          </p>
        </div>
      </section>

    </div>
  );
}
