import Link from 'next/link';
import { Metadata } from 'next';
import { SUBSCRIPTION } from '@repo/config';
import { Check, ArrowRight, MapPin } from 'lucide-react';

import { ROICalculator } from '@/components/landing/roi-calculator';
import { FeatureTabs } from '@/components/landing/feature-tabs';
import { ComparisonTable } from '@/components/landing/comparison-table';
import { FAQ } from '@/components/landing/faq';

export const metadata: Metadata = {
  title: 'Workers Hive | Smart Staff Scheduling',
  description: 'The easiest way to schedule your hospitality team. Build rosters, publish shifts, and track time in minutes.',
};

const win2k = {
  fontFamily: 'Tahoma, "MS Sans Serif", Arial, sans-serif',
};

/** Win2K raised button */
function Win2KButton({ children, primary, href }: { children: React.ReactNode; primary?: boolean; href: string }) {
  return (
    <Link href={href}>
      <button
        className="px-5 py-1.5 text-sm font-bold text-black cursor-pointer active:translate-x-px active:translate-y-px"
        style={{
          ...win2k,
          background: primary
            ? 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)'
            : 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
          border: '2px solid',
          borderColor: '#ffffff #808080 #808080 #ffffff',
          outline: primary ? '1px solid #0a246a' : undefined,
          boxShadow: '1px 1px 0 #000',
          minWidth: 120,
        }}
      >
        {children}
      </button>
    </Link>
  );
}

/** Win2K window chrome wrapper */
function Win2KWindow({ title, icon, children, className }: {
  title: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        border: '2px solid',
        borderColor: '#ffffff #808080 #808080 #ffffff',
        boxShadow: '2px 2px 6px rgba(0,0,0,0.4)',
        background: '#ece9d8',
        ...win2k,
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-2 h-7 select-none"
        style={{
          background: 'linear-gradient(to right, #0a246a, #3a6ea5)',
        }}
      >
        <div className="flex items-center gap-1.5">
          {icon && (
            <div
              className="w-3.5 h-3.5 flex items-center justify-center text-[8px] font-black text-white"
              style={{ background: 'linear-gradient(135deg, #fffb00, #ff8c00)' }}
            >
              {icon}
            </div>
          )}
          <span className="text-white text-[11px] font-bold">{title}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {['_', '□', '✕'].map((c, i) => (
            <div
              key={i}
              className="w-5 h-4 flex items-center justify-center text-[9px] font-black"
              style={{
                background: i === 2 ? 'linear-gradient(180deg,#d9534f,#9b1c1c)' : 'linear-gradient(180deg,#dce4f5,#b0c4de)',
                color: i === 2 ? '#fff' : '#000',
                border: '1px solid',
                borderColor: i === 2 ? '#7a1010' : '#6b7faa',
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
      {/* Window body */}
      <div className="p-3" style={{ background: '#ece9d8' }}>
        {children}
      </div>
    </div>
  );
}

/** Sunken inset panel */
function InsetPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        border: '2px solid',
        borderColor: '#808080 #ffffff #ffffff #808080',
        background: '#ffffff',
        padding: '8px',
      }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: '#008080', ...win2k }}
    >
      {/* Desktop "wallpaper" area with window */}
      <section className="px-4 py-6 lg:px-12 lg:py-10">
        <Win2KWindow
          title="Workers Hive - Smart Staff Scheduling [Running] - Microsoft Internet Explorer"
          icon="W"
          className="w-full"
        >
          {/* Toolbar inside window */}
          <div
            className="flex items-center gap-1 px-2 py-1 mb-3 -mx-3 -mt-3"
            style={{
              background: '#ece9d8',
              borderBottom: '1px solid #aca899',
            }}
          >
            {['Back', 'Forward', 'Stop', 'Refresh', 'Home', 'Search', 'Favorites', 'History'].map((btn) => (
              <button
                key={btn}
                className="px-2 py-0.5 text-[10px] text-black"
                style={{
                  background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                  border: '2px solid',
                  borderColor: '#ffffff #808080 #808080 #ffffff',
                }}
              >
                {btn}
              </button>
            ))}
          </div>

          {/* Hero content area */}
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start">
            {/* Left content */}
            <div className="lg:w-1/2 space-y-4">
              {/* Marquee notice */}
              <div
                className="text-[11px] font-bold px-2 py-1 text-white overflow-hidden"
                style={{ background: '#000080' }}
              >
                <div
                  className="whitespace-nowrap"
                  style={{
                    animation: 'win2k-marquee 18s linear infinite',
                    display: 'inline-block',
                  }}
                >
                  *** NEW: Workers Hive v2.0 Now Available! Flat pricing for ALL staff sizes. Download the free trial today! *** Visit our website at workershive.com ***
                </div>
              </div>

              {/* Main heading in a sunken panel */}
              <InsetPanel>
                <h1
                  className="text-3xl lg:text-4xl font-black leading-tight"
                  style={{ color: '#000080', ...win2k }}
                >
                  Scheduling made <br />
                  <span style={{ color: '#cc0000' }}>effortless.</span>
                </h1>
                <p
                  className="mt-3 text-sm leading-relaxed"
                  style={{ color: '#333333' }}
                >
                  Stop wrestling with spreadsheets. Build rosters, publish shifts, and track time in minutes. The modern tool for modern venues.
                </p>
              </InsetPanel>

              {/* Buttons */}
              <div className="flex flex-wrap gap-3 pt-1">
                <Win2KButton href="/auth/signup" primary>
                  Get Started Free ▶
                </Win2KButton>
                <Win2KButton href="/how-it-works">
                  How it Works
                </Win2KButton>
              </div>

              {/* Checkbox-style trust signals */}
              <div
                className="flex flex-col gap-1.5 pt-1"
                style={{ color: '#333' }}
              >
                {['No credit card required', 'Cancel anytime', `${SUBSCRIPTION.TRIAL_DAYS}-Day Free Trial included`].map((item) => (
                  <label key={item} className="flex items-center gap-2 text-[11px] cursor-default">
                    <div
                      className="w-3.5 h-3.5 flex items-center justify-center text-[9px] font-black"
                      style={{
                        background: '#fff',
                        border: '2px solid',
                        borderColor: '#808080 #fff #fff #808080',
                        color: '#006400',
                      }}
                    >
                      ✓
                    </div>
                    {item}
                  </label>
                ))}
              </div>

              {/* Progress bar decoration */}
              <div className="pt-2">
                <div
                  className="text-[10px] mb-1"
                  style={{ color: '#555' }}
                >
                  Loading awesome features... 100%
                </div>
                <div
                  className="h-4 w-full"
                  style={{
                    border: '2px solid',
                    borderColor: '#808080 #fff #fff #808080',
                    background: '#fff',
                  }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: '100%',
                      background: 'repeating-linear-gradient(90deg, #316ac5 0px, #316ac5 12px, #4f8ad4 12px, #4f8ad4 24px)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Right: Shift "dialog" window */}
            <div className="lg:w-1/2 w-full">
              <Win2KWindow title="Dinner Service - Active Shift" icon="S">
                <div className="space-y-3">
                  {/* Shift header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div
                        className="text-sm font-black"
                        style={{ color: '#000080' }}
                      >
                        Dinner Service
                      </div>
                      <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#555' }}>
                        5:00 PM - 11:00 PM
                      </div>
                    </div>
                    <div
                      className="px-2 py-0.5 text-[10px] font-black text-white"
                      style={{ background: '#cc0000', border: '1px solid #800000' }}
                    >
                      LIVE
                    </div>
                  </div>

                  {/* Staff Row 1 - On Site */}
                  <InsetPanel>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 flex items-center justify-center font-black text-sm"
                        style={{
                          background: 'linear-gradient(180deg, #dce4f5 0%, #b0c4de 100%)',
                          border: '2px solid',
                          borderColor: '#fff #808080 #808080 #fff',
                          color: '#000080',
                        }}
                      >
                        SJ
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold" style={{ color: '#000' }}>Sarah Jenkins</span>
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5"
                            style={{
                              background: '#00aa00',
                              color: '#fff',
                              border: '1px solid #005500',
                            }}
                          >
                            ON SITE
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px]" style={{ color: '#555' }}>
                          <MapPin className="w-2.5 h-2.5" />
                          Geofence Verified 4:55 PM
                        </div>
                      </div>
                    </div>
                  </InsetPanel>

                  {/* Staff Row 2 - Scheduled */}
                  <div
                    className="flex items-center gap-3 px-2 py-2 opacity-70"
                    style={{
                      border: '1px dashed #808080',
                      background: '#f0f0ea',
                    }}
                  >
                    <div
                      className="w-10 h-10 flex items-center justify-center font-black text-sm"
                      style={{
                        background: '#d4d0c8',
                        border: '2px solid',
                        borderColor: '#fff #808080 #808080 #fff',
                        color: '#555',
                      }}
                    >
                      MC
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold" style={{ color: '#555' }}>Marcus Chen</span>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5"
                          style={{
                            background: '#d4d0c8',
                            color: '#555',
                            border: '1px solid #808080',
                          }}
                        >
                          SCHEDULED
                        </span>
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: '#777' }}>
                        Shift starts in 15 mins
                      </div>
                    </div>
                  </div>

                  {/* Status bar */}
                  <div
                    className="flex justify-between items-center text-[10px] font-bold px-1 pt-2"
                    style={{
                      borderTop: '1px solid #aca899',
                      color: '#555',
                    }}
                  >
                    <span>ROSTER: 4/5 CHECKED IN</span>
                    <span>EST. LABOR: $420</span>
                  </div>
                </div>
              </Win2KWindow>

              {/* Taskbar-style info strip */}
              <div
                className="mt-3 flex items-center gap-4 px-3 py-1.5 text-[10px] font-bold"
                style={{
                  background: '#d4d0c8',
                  border: '2px solid',
                  borderColor: '#fff #808080 #808080 #fff',
                  color: '#333',
                }}
              >
                <span
                  className="px-2 py-0.5"
                  style={{ background: '#316ac5', color: '#fff', border: '1px solid #0a246a' }}
                >
                  HOSPITALITY
                </span>
                <span>Flat Pricing: ${SUBSCRIPTION.MONTHLY_PRICE_USD}/mo</span>
                <span className="ml-auto">✓ Unlimited Staff</span>
              </div>
            </div>
          </div>

          {/* IE-style status bar */}
          <div
            className="flex items-center justify-between px-2 py-0.5 mt-4 -mx-3 -mb-3 text-[10px]"
            style={{
              background: '#ece9d8',
              borderTop: '1px solid #aca899',
              color: '#555',
            }}
          >
            <span>Done</span>
            <div className="flex items-center gap-3">
              <span>Internet zone</span>
              <span>100%</span>
            </div>
          </div>
        </Win2KWindow>
      </section>

      {/* Sub-sections */}
      <ROICalculator />
      <FeatureTabs />
      <ComparisonTable />
      <FAQ />

      {/* Final CTA — styled as a Win2K dialog box */}
      <section
        className="py-16 px-4 lg:px-12"
        style={{ background: '#008080' }}
      >
        <div className="max-w-2xl mx-auto">
          <Win2KWindow title="Workers Hive Setup Wizard - Step 1 of 1" icon="W">
            <div className="text-center space-y-4 py-4">
              {/* Wizard icon area */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-16 h-16 flex items-center justify-center text-2xl font-black shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #316ac5, #0a246a)',
                    color: '#fff',
                    border: '2px solid',
                    borderColor: '#fff #808080 #808080 #fff',
                  }}
                >
                  W
                </div>
                <InsetPanel className="text-left flex-1">
                  <p className="text-sm font-black" style={{ color: '#000080' }}>
                    Ready to upgrade your operations?
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: '#333' }}>
                    Workers Hive Setup Wizard will install the following components: Smart Scheduling, GPS Timeclock, Roster Management, Flat Rate Billing.
                  </p>
                </InsetPanel>
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  background: 'linear-gradient(to right, transparent, #808080, transparent)',
                  margin: '8px 0',
                }}
              />

              <p className="text-[11px]" style={{ color: '#555' }}>
                Setup takes 5 minutes. Import your roster via CSV. Cancel anytime.
              </p>

              <div className="flex justify-center gap-3 pt-2">
                <Link href="/auth/signup">
                  <button
                    className="px-8 py-2 text-sm font-black text-black"
                    style={{
                      background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                      border: '2px solid',
                      borderColor: '#ffffff #808080 #808080 #ffffff',
                      outline: '1px solid #0a246a',
                      boxShadow: '1px 1px 0 #000',
                    }}
                  >
                    Start {SUBSCRIPTION.TRIAL_DAYS}-Day Free Trial
                  </button>
                </Link>
                <Link href="/how-it-works">
                  <button
                    className="px-8 py-2 text-sm font-bold text-black"
                    style={{
                      background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                      border: '2px solid',
                      borderColor: '#ffffff #808080 #808080 #ffffff',
                      boxShadow: '1px 1px 0 #000',
                    }}
                  >
                    Cancel
                  </button>
                </Link>
              </div>
            </div>
          </Win2KWindow>

          {/* Taskbar */}
          <div
            className="mt-2 flex items-center justify-between px-3 py-1 text-[10px]"
            style={{
              background: 'linear-gradient(180deg, #1c5fab 0%, #1a3c91 100%)',
              color: '#fff',
              border: '2px solid',
              borderColor: '#3a6ea5 #0a246a #0a246a #3a6ea5',
            }}
          >
            <span className="font-bold">Start</span>
            <div className="flex items-center gap-4">
              <span>Workers Hive</span>
              <span>|</span>
              <span>
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
