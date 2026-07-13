import React, { useState } from 'react';
import { 
  Lock, 
  Plus, 
  BadgeAlert, 
  Orbit, 
  ChevronDown, 
  TrendingUp, 
  TrendingDown, 
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { PortfolioHolding, TradeHistory, Profile, Portfolio, PortfolioHistory } from '../types';
import PerformanceChart from './PerformanceChart';

interface DashboardProps {
  portfolios: Portfolio[];
  portfolioHistory: PortfolioHistory[];
  holdings: PortfolioHolding[];
  trades: TradeHistory[];
  currentUser: Profile | null;
  onUpgrade: () => void;
  onReset: () => void;
  paywallsEnabled: boolean;
  onAddPositionClick?: () => void;
}

export default function Dashboard({ 
  portfolios, 
  portfolioHistory, 
  holdings, 
  trades, 
  currentUser, 
  onUpgrade, 
  paywallsEnabled,
  onAddPositionClick
}: DashboardProps) {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('p1');
  const [expandedTradeIds, setExpandedTradeIds] = useState<Record<string, boolean>>({});

  const toggleTrade = (id: string) => {
    setExpandedTradeIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Check access permissions
  const hasAccess = !paywallsEnabled || (currentUser && currentUser.subscription_tier !== 'none');

  // Active Portfolio details
  const currentPortfolio = portfolios.find(p => p.id === selectedPortfolioId) || portfolios[0];

  // Filters
  const activeHoldings = holdings.filter(h => h.portfolio_id === currentPortfolio?.id);
  const activeTrades = trades.filter(t => t.portfolio_id === currentPortfolio?.id);
  const activeHistory = portfolioHistory.filter(ph => ph.portfolio_id === currentPortfolio?.id);

  return (
    <div className="w-full bg-rg-cream min-h-screen text-stone-900 font-sans antialiased pb-16 relative overflow-hidden select-none">
      
      {/* Upper clean info header bar */}
      <div className="bg-white/40 border-b border-stone-200/80 py-3.5 px-6 lg:px-8 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-rg-orange animate-pulse"></span>
          <span className="text-[10px] font-bold text-stone-600 font-mono tracking-widest uppercase">Seneca Terminal</span>
        </div>
        

      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* PREMIUM LICENSING GATE BANNER (IF GUEST/RESTRICTED) */}
        {!hasAccess && (
          <div className="mb-8 p-6 rounded-2xl bg-rg-clay-light/70 border border-rg-orange/20 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-rg-orange border border-rg-orange/25">
                <Lock className="h-4.5 w-4.5 animate-pulse" />
              </span>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 font-mono">Premium Protection Models Gate</h4>
                <p className="text-xs text-stone-600 mt-1 max-w-xl leading-relaxed">
                  Historical index trendlines are fully accessible. To unlock specific asset weights, transaction dispatches, and catalyst commentary, activate an authorized licensing tier.
                </p>
              </div>
            </div>
            
            <button
              onClick={onUpgrade}
              className="rounded-full bg-rg-orange hover:bg-rg-clay text-white px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-150 cursor-pointer shadow-sm shrink-0"
            >
              Authorize Licensing
            </button>
          </div>
        )}

        {/* INTRO TITLE BLURB (WITHOUT MOCK TOTAL CAPITAL) */}
        <div className="mb-8 text-left">
          <h1 className="text-2xl font-black tracking-tight text-stone-900">
            {currentPortfolio?.name || 'Model Portfolio Parameters'}
          </h1>
          <p className="text-xs text-stone-500 mt-1.5 max-w-2xl">
            {currentPortfolio?.description || 'Inspect cumulative position values, underlying index tracking benchmarks, and real-time strategic dispatches.'}
          </p>
        </div>

        {/* MAIN TWO-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: VISUAL INDEX PERFORMANCE & TRANSACTION LOGS */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* PERFORMANCE CHART */}
            <div id="performance-chart-box">
              <PerformanceChart 
                historyPoints={activeHistory} 
                portfolioName={currentPortfolio?.name || "Target Index"} 
              />
            </div>

            {/* TRANSACTIONS / EXECUTION Commentary LIST */}
            <div id="recent-transactions" className="bg-white border border-stone-200 rounded-3xl p-6.5 text-left shadow-[0_8px_30px_rgba(0,0,0,0.01)]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 font-mono">
                    Model Dispatch Logs
                  </h3>
                  <p className="text-[10px] text-stone-500 mt-0.5 font-sans">
                    Chronological list of recent strategic rebalancing and dispatches.
                  </p>
                </div>
              </div>

              {!hasAccess ? (
                <div className="relative py-12 text-center bg-stone-50/50 border border-stone-200 rounded-2xl">
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
                    <Lock className="h-5 w-5 text-stone-400 mb-2" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 font-mono">Dispatches Redacted</h4>
                    <p className="text-[10px] text-stone-500 mt-1 max-w-xs font-sans leading-relaxed">
                      License model credentials are required to view recent execution comment narratives.
                    </p>
                  </div>
                </div>
              ) : activeTrades.length === 0 ? (
                <div className="py-12 text-center text-stone-500 text-xs italic font-mono bg-stone-50/50 border border-stone-150 rounded-2xl">
                  No execution logs registered within this portfolio parameters.
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {activeTrades.slice().reverse().map((t) => {
                    const isExpanded = expandedTradeIds[t.id];
                    const isBuy = t.type === 'BUY';
                    
                    return (
                      <div key={t.id} className="py-4 px-1 hover:bg-stone-50 transition rounded-xl">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 text-left">
                            <div className="h-9 w-9 rounded-full border border-stone-200 bg-stone-50 text-stone-600 flex items-center justify-center shrink-0">
                              <Orbit className="h-4 w-4 text-stone-500" />
                            </div>
                            <div>
                              <div className="font-bold text-stone-900 text-sm font-sans tracking-tight">
                                {t.ticker}
                              </div>
                              
                              <button
                                onClick={() => toggleTrade(t.id)}
                                className="text-[10px] text-stone-400 font-bold hover:text-rg-orange transition flex items-center gap-1 mt-0.5 cursor-pointer"
                              >
                                {isExpanded ? 'Hide dissertation analysis' : 'Show positioning case thesis'}
                                <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-end">
                            <span className="font-bold text-stone-900 text-sm font-mono uppercase">
                              {t.type}
                            </span>
                            
                            <span className={`inline-flex items-center gap-1 rounded bg-stone-50 px-2 py-0.5 text-[8px] font-bold border tracking-wider mt-1.5 ${
                              isBuy 
                                ? 'bg-emerald-50/50 border-emerald-250 text-emerald-800' 
                                : 'bg-stone-100 border-stone-250 text-stone-600'
                            }`}>
                              {isBuy ? 'DISPATCHED' : 'LIQUIDATED'}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 border border-stone-205 rounded-2xl bg-stone-50/50 p-5 text-xs text-stone-600 leading-relaxed max-w-full text-left animate-fade-in">
                            <div className="flex items-center justify-between border-b border-stone-150 pb-2.5 mb-3 font-mono text-[9px] font-bold text-stone-400 uppercase tracking-widest">
                              <span>Position Case File: {t.ticker}</span>
                              <span>Timestamp: {new Date(t.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="font-sans leading-relaxed text-stone-600 whitespace-pre-line bg-white p-4 rounded-xl border border-stone-150">
                              {t.analysis_text || "No comprehensive transaction narrative commentary registered."}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: PORTFOLIO LISTS & ACTIVE POSITIONS LISTS */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* PORTFOLIOS MANDATES LIST SELECTOR */}
            <div id="deck-wallets" className="bg-white border border-stone-200 rounded-3xl p-6.5 text-left shadow-[0_8px_30px_rgba(0,0,0,0.01)]">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 font-mono mb-4">
                Model Mandate Portfolios
              </h3>
              
              <div className="space-y-3">
                {portfolios.map((p) => {
                  const isSelected = p.id === selectedPortfolioId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPortfolioId(p.id)}
                      className={`group rounded-2xl p-4 border transition-all duration-150 cursor-pointer text-left ${
                        isSelected
                          ? 'bg-rg-green border-rg-green text-white shadow-md shadow-rg-green/10'
                          : 'bg-stone-50/50 border-stone-200 text-stone-900 hover:bg-stone-50 hover:border-rg-orange/25'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span className={`text-[8px] uppercase tracking-widest font-mono font-bold ${
                          isSelected ? 'text-rg-orange' : 'text-stone-450'
                        }`}>
                          {p.category}
                        </span>
                        <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-rg-orange/10 text-rg-orange border border-rg-orange/20' : 'bg-white text-stone-500 border border-stone-200'
                        }`}>
                          {p.risk_profile}
                        </span>
                      </div>

                      <h4 className={`text-xs font-bold uppercase tracking-wide ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                        {p.name}
                      </h4>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* POSITIONS WITHIN THE PORTFOLIO */}
            <div id="contracts-list" className="bg-white border border-stone-200 rounded-3xl p-6.5 text-left shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 font-mono">
                    Mandate Positions ({activeHoldings.length})
                  </h3>
                  <p className="text-[10px] text-stone-500 mt-0.5">
                    Live active asset weights tracked in model.
                  </p>
                </div>
                
                {onAddPositionClick && (
                  <button
                    onClick={onAddPositionClick}
                    className="rounded-full border border-stone-200 hover:bg-stone-50 px-3 py-1.5 text-[9px] font-bold text-stone-700 bg-white transition cursor-pointer flex items-center gap-1 uppercase tracking-widest font-mono select-none"
                  >
                    <Plus className="h-3 w-3 text-stone-500" />
                    ADD
                  </button>
                )}
              </div>

              {!hasAccess ? (
                <div className="py-8 text-center text-stone-400 text-xs italic font-mono bg-stone-50/50 rounded-2xl border border-stone-200/50">
                  Detailed active allocations redacted
                </div>
              ) : activeHoldings.length === 0 ? (
                <div className="py-8 text-center text-stone-500 text-xs italic font-mono">
                  No active holdings recorded.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {activeHoldings.map((h, index) => {
                    const isEven = index % 2 === 0;
                    const bulletSymbol = (h.ticker.split(' ')[0][0] || 'A').toUpperCase();

                    return (
                      <div key={h.id} className="p-4 rounded-2xl border border-stone-200 bg-stone-50/20 hover:bg-rg-clay-light/35 hover:border-rg-orange/20 transition duration-150 flex flex-col justify-between gap-3">
                        
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3 text-left">
                            <span className="h-8 w-8 rounded-full border border-rg-orange/20 bg-rg-clay-light text-rg-orange flex items-center justify-center text-xs font-black font-sans shrink-0">
                              {bulletSymbol}
                            </span>
                            <div>
                              <h4 className="font-bold text-stone-900 text-sm font-sans tracking-tight leading-none truncate max-w-[140px]">
                                {h.company_name}
                              </h4>
                              <span className="text-[10px] text-stone-450 font-mono mt-1.5 block">{h.ticker}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-bold text-rg-orange text-sm block font-mono">
                              {h.allocation_pct}%
                            </span>
                            <span className="text-[8px] font-mono text-stone-400 block mt-0.5 uppercase tracking-wider font-bold">
                              Weight
                            </span>
                          </div>
                        </div>

                        {/* Position math detail */}
                        <div className="flex justify-between items-center text-[9px] font-mono text-stone-400 mt-1 border-t border-stone-100 pt-2 font-medium">
                          <span>Purchase: {h.avg_purchase_price.toLocaleString()} {h.currency || 'SEK'}</span>
                          <span className="font-bold text-stone-700">Spot: {h.current_price.toLocaleString()} {h.currency || 'SEK'}</span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>

          </div>

        </div>

        {/* REGULATORY DISCLAIMER FOOTER */}
        <footer className="mt-20 border-t border-stone-200/60 pt-12 pb-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-50 border border-stone-150 text-stone-400 mb-3 shadow-sm">
              <BadgeAlert className="h-4 w-4" />
            </div>

            <h4 className="font-sans text-[10px] font-black uppercase tracking-[0.2em] text-stone-900 mb-3">
              Regulatory Compliance &amp; Disclosure Protocol
            </h4>

            <p className="text-[11px] text-stone-400 leading-relaxed font-sans max-w-2xl mx-auto font-medium">
              The information compiled on this financial analysis interface is provided solely for general illustration and portfolio benchmarking purposes. No published content represents personal investment advice, a recommendation to trade securities, or structural asset management decisions. Securities investment is subject to extreme market volatilities and structural variables. Historical yield is illustrative only and cannot assure future client wealth outcomes.
            </p>

            <div className="mt-8 pt-6 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[9px] font-mono text-stone-400 font-medium">
              <span>© {new Date().getFullYear()} Seneca Capital AB. Institutional Model Disclosures.</span>
              <div className="flex gap-4">
                <span className="hover:text-stone-850 transition cursor-pointer">Security Protocol</span>
                <span className="hover:text-stone-850 transition cursor-pointer">Verified Gateway</span>
              </div>
            </div>

          </div>
        </footer>

      </div>
    </div>
  );
}
