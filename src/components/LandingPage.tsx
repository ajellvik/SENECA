import React, { useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { Profile } from '../types';

interface LandingPageProps {
  currentUser: Profile | null;
  onSelectTier: (tier: 'small' | 'mid' | 'large', price: number, name: string) => void;
  onOpenAuth: () => void;
  setView: (view: string) => void;
  paywallsEnabled: boolean;
}

export default function LandingPage({ currentUser, onSelectTier, onOpenAuth, setView, paywallsEnabled }: LandingPageProps) {
  const [showComplianceDetail, setShowComplianceDetail] = useState(false);
  
  const tiers = [
    {
      id: 'small' as const,
      name: 'Basic License',
      capital: 'Portfolio Under SEK 100K eq.',
      price: 500,
      description: 'Designed for individual savers seeking institutional-grade visibility into high-conviction compounders.',
      features: [
        'Full visibility of model positions',
        'Real-time buy & sell dispatch logs',
        'Concise transaction commentary',
        'Earnings & research updates'
      ],
      highlighted: false,
    },
    {
      id: 'mid' as const,
      name: 'Standard License',
      capital: 'Portfolio Under SEK 1.5M eq.',
      price: 2000,
      description: 'Our most requested, tailored for investors who systematically benchmark Nordic and global equity indices.',
      features: [
        'Everything in Basic included',
        'Valuation & risk barrier audits',
        'Instant coverage updates',
        'Nordic macro climate bulletins'
      ],
      highlighted: true,
    },
    {
      id: 'large' as const,
      name: 'Partner License',
      capital: 'Portfolio Under SEK 10M eq.',
      price: 10000,
      description: 'Designed for high-net-worth accounts, single-family offices, and advanced quantitative research.',
      features: [
        'Everything in Standard included',
        'Institutional research dossiers',
        'Direct manager hotline access',
        'Private Client support manager'
      ],
      highlighted: false,
    }
  ];

  const handleTierSelection = (tierId: 'small' | 'mid' | 'large', price: number, name: string) => {
    if (!currentUser) {
      onOpenAuth();
    } else {
      onSelectTier(tierId, price, name);
    }
  };

  return (
    <div className="bg-rg-cream min-h-screen font-sans antialiased text-stone-900 select-none">
      
      {/* Subdued, Clean Typographic Hero Section */}
      <section className="relative pt-24 pb-16 mx-auto max-w-4xl px-6 text-center">
        <div className="space-y-6">
          <div className="flex justify-center items-center gap-1.5 text-[10px] font-mono tracking-[0.25em] text-rg-orange font-bold uppercase">
            <span>Long-term Capital Allocation</span>
          </div>

          <h1 className="text-4.5xl sm:text-5xl font-black tracking-tight leading-[1.1] text-stone-900">
            Sovereign equity benchmarks.<br />
            <span className="font-serif italic font-normal text-rg-green">Transparent. Real-time.</span>
          </h1>

          <p className="mx-auto max-w-xl text-stone-500 text-sm leading-relaxed sm:leading-loose">
            An institutional-grade model portfolio tracking high-conviction Nordic compounders. Monitor position weights, execution logs, and fundamental corporate balance-sheet research.
          </p>

          <div className="pt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
            {!paywallsEnabled ? (
              <button
                onClick={() => setView('dashboard')}
                className="w-full sm:w-auto rounded-full bg-rg-orange hover:bg-rg-clay text-white font-bold tracking-widest text-[10px] uppercase py-4 px-8 transition duration-150 cursor-pointer text-center shadow-lg shadow-rg-orange/15 transform active:translate-y-px"
              >
                Access Model Portfolios
              </button>
            ) : currentUser && currentUser.subscription_tier !== 'none' ? (
              <button
                onClick={() => setView('dashboard')}
                className="w-full sm:w-auto rounded-full bg-rg-orange hover:bg-rg-clay text-white font-bold tracking-widest text-[10px] uppercase py-4 px-8 transition duration-150 cursor-pointer text-center shadow-lg shadow-rg-orange/15 transform active:translate-y-px"
              >
                Open Investor Dashboard
              </button>
            ) : (
              <a
                href="#pricing-section"
                className="w-full sm:w-auto rounded-full bg-rg-orange hover:bg-rg-clay text-white font-bold tracking-widest text-[10px] uppercase py-4 px-8 transition duration-150 cursor-pointer text-center shadow-lg shadow-rg-orange/15 transform active:translate-y-px"
              >
                Request Licensure
              </a>
            )}
            
            <button
              onClick={() => {
                const el = document.getElementById('pricing-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto rounded-full bg-white border border-stone-200 hover:border-rg-orange hover:text-rg-orange text-stone-800 tracking-widest text-[10px] uppercase py-4 px-8 transition duration-150 cursor-pointer font-bold duration-150 text-center shadow-xs"
            >
              See Pricing Plans
            </button>
          </div>
        </div>
      </section>

      {/* Subdued Minimalist Core Value Line */}
      <section className="border-y border-stone-200/60 py-12 bg-white/40">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-left space-y-1.5">
              <span className="font-mono text-[9px] font-bold text-rg-orange tracking-widest block uppercase">01 / Full Transparency</span>
              <p className="text-stone-500 text-xs leading-relaxed">
                Every trade action is listed instantly, showcasing exact cost basis, transaction rationale, and weight shift parameters.
              </p>
            </div>
            <div className="text-left space-y-1.5">
              <span className="font-mono text-[9px] font-bold text-rg-orange tracking-widest block uppercase">02 / Deep Conviction</span>
              <p className="text-stone-500 text-xs leading-relaxed">
                Positions are supported exclusively by thorough small-cap research, free cash flow models, and catalysts.
              </p>
            </div>
            <div className="text-left space-y-1.5">
              <span className="font-mono text-[9px] font-bold text-rg-orange tracking-widest block uppercase">03 / Secure Gateway</span>
              <p className="text-stone-500 text-xs leading-relaxed">
                Licenses and recurring subscriber checkouts are routed securely by Stripe gateway under standard end-to-end encryption.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Tiers Section */}
      {paywallsEnabled && (
        <section id="pricing-section" className="mx-auto max-w-5xl px-6 py-20">
          <div className="text-center mb-16 space-y-2">
            <div className="font-mono text-[9px] text-rg-orange uppercase tracking-widest font-bold">Access Licensure</div>
            <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Select your licensing tier</h2>
            <p className="mx-auto max-w-md text-stone-500 text-xs leading-relaxed">
              Kindly choose the license corresponding to your active capital base to maintain appropriate compliance parameters.
            </p>
          </div>

          {/* Clean Unified Pricing Cards */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 items-stretch">
            {tiers.map((tier) => {
              const isUserTier = currentUser?.subscription_tier === tier.id;
              return (
                <div
                  key={tier.id}
                  className={`flex flex-col justify-between rounded-2xl p-6.5 border transition-all duration-150 bg-white ${
                    tier.highlighted
                      ? 'border-rg-orange ring-1 ring-rg-orange shadow-md shadow-rg-orange/5 bg-rg-clay-light/25'
                      : 'border-stone-200/80 hover:border-rg-orange/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className={`text-xs font-bold uppercase tracking-widest ${tier.highlighted ? 'text-rg-orange' : 'text-stone-900'}`}>{tier.name}</h3>
                      {isUserTier && (
                        <span className="rounded bg-rg-orange/10 px-2 py-0.5 text-[8px] font-bold text-rg-orange uppercase border border-rg-orange/20 tracking-wider">
                          Active
                        </span>
                      )}
                    </div>

                    <p className="text-[8px] text-stone-400 font-mono tracking-widest uppercase mt-2">
                      {tier.capital}
                    </p>

                    <div className="mt-5 flex items-baseline">
                      <span className="text-xl font-mono text-stone-900 font-bold tracking-tight">
                        SEK {tier.price.toLocaleString('sv-SE')}
                      </span>
                      <span className="ml-1 text-[10px] text-stone-400">/ mo</span>
                    </div>

                    <p className="mt-3 text-xs text-stone-500 leading-relaxed font-sans">{tier.description}</p>

                    <ul className="mt-6 pt-5 border-t border-stone-100 space-y-3">
                      {tier.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-stone-600">
                          <Check className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${tier.highlighted ? 'text-rg-orange' : 'text-stone-400'}`} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-stone-100">
                    <button
                      onClick={() => handleTierSelection(tier.id, tier.price, tier.name)}
                      className={`w-full rounded-full py-2.5 text-[10px] font-bold tracking-widest uppercase transition duration-150 cursor-pointer ${
                        isUserTier
                          ? 'bg-stone-50 text-stone-305 border border-stone-200 cursor-default'
                          : tier.highlighted
                          ? 'bg-rg-orange text-white hover:bg-rg-clay shadow-xs'
                          : 'bg-white text-stone-800 border border-stone-200 hover:border-rg-orange hover:text-rg-orange'
                      }`}
                    >
                      {isUserTier ? 'Current plan' : 'Select plan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Simple Compliance Hook */}
          <div className="mt-16 text-center max-w-lg mx-auto">
            <button 
              onClick={() => setShowComplianceDetail(!showComplianceDetail)}
              className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-stone-400 hover:text-stone-900 transition font-bold"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>PCI-DSS SSL Standards</span>
            </button>
            
            {showComplianceDetail && (
              <div className="mt-4 p-4 rounded-xl bg-[#fafafa] border border-stone-100 text-left text-[9px] text-stone-500 leading-normal font-mono space-y-1 animate-fade-in max-w-sm mx-auto">
                <div>• Stripe TLS End-to-end Protocol</div>
                <div>• Zero plaintext storage on servers</div>
                <div>• Persistent cloud-state verification</div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Simplified, Humble Custom Footer */}
      <footer className="border-t border-stone-100 bg-white py-12">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-[10px] font-mono text-stone-400 font-medium">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[10px] font-black uppercase tracking-[0.15em] text-stone-800">Seneca Capital</span>
            <span className="h-1 w-1 rounded-full bg-stone-300" />
            <span>© {new Date().getFullYear()}. All rights reserved.</span>
          </div>
          <div className="flex gap-6 uppercase tracking-wider font-bold">
            <span className="hover:text-stone-900 transition cursor-pointer">Licensure Terms</span>
            <span className="hover:text-stone-900 transition cursor-pointer">Privacy Protocol</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
