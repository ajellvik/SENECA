import React, { useState } from 'react';
import { Copy, Check, Database, ShieldAlert, Sparkles } from 'lucide-react';

export default function SchemaView() {
  const [copied, setCopied] = useState(false);

  const sqlCode = `-- Create Profiles Table (Syncs with Supabase Authentication)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  subscription_tier TEXT NOT NULL DEFAULT 'none' CHECK (subscription_tier IN ('none', 'small', 'mid', 'large')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Portfolios Table (Multiple portfolios support)
CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  risk_profile TEXT NOT NULL,
  target_subscription_tier TEXT NOT NULL DEFAULT 'small' CHECK (target_subscription_tier IN ('none', 'small', 'mid', 'large')),
  currency TEXT NOT NULL DEFAULT 'SEK'
);

-- Create Portfolio Holdings Table
CREATE TABLE public.portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  allocation_pct NUMERIC NOT NULL CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  avg_purchase_price NUMERIC NOT NULL CHECK (avg_purchase_price >= 0),
  current_price NUMERIC NOT NULL CHECK (current_price >= 0),
  currency TEXT NOT NULL DEFAULT 'SEK'
);

-- Create Trade History Table
CREATE TABLE public.trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  ticker TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  analysis_text TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SEK'
);

-- Create Weekly Portfolio Index/Performance History (Marketing Channel)
CREATE TABLE public.portfolio_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  index_value NUMERIC NOT NULL,
  note TEXT
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_history ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ PERMISSIVE (Permits potential clients to view general performance charts)
CREATE POLICY "Anyone can read portfolios" 
  ON public.portfolios FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can read portfolio history index values" 
  ON public.portfolio_history FOR SELECT TO public USING (true);

-- PROTECTED READ SECURE (Active paying subscribers only)
CREATE POLICY "Allow select on portfolio_holdings for active subscribers" 
  ON public.portfolio_holdings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.subscription_tier != 'none'
    )
  );

CREATE POLICY "Allow select on trade_history for active subscribers" 
  ON public.trade_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.subscription_tier != 'none'
    )
  );`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="schema-setup-view" className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center mb-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Database className="h-5 w-5 text-emerald-600" />
            Supabase DB Schema &amp; Security (RLS) Rules (Flera Portföljer)
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Reviderat och uppdaterat PostgreSQL-skript som stödjer parallella modellportföljer och historiska indexgrafer.
          </p>
        </div>
        <button
          onClick={copyToClipboard}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied SQL Code
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy RLS Code
            </>
          )}
        </button>
      </div>

      <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Security RLS Marketing Principle:</span> 
            <p className="mt-1">
              Både <code className="bg-yellow-105 px-1 py-0.5 rounded text-xs">portfolios</code> och <code className="bg-yellow-105 px-1 py-0.5 rounded text-xs">portfolio_history</code> har lanserats med öppna läspolicies så att <strong>icke-betalande användare (potentiella kunder) kan se snygga historiska grafer</strong> för att Lockas till abonnemang. Däremot förblir de känsliga innehållstabellerna <code className="bg-yellow-105 px-1 py-0.5 rounded text-xs">portfolio_holdings</code> och <code className="bg-yellow-105 px-1 py-0.5 rounded text-xs">trade_history</code> helt låsta av RLS.
            </p>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900 shadow-inner">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2">
          <span className="font-mono text-xs text-slate-400">setup_multiportfolio_rls.sql</span>
          <span className="rounded bg-emerald-950/40 border border-emerald-800 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400">
            PostgreSQL v16
          </span>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-xs line-clamp-[12] md:line-clamp-none text-slate-300 leading-relaxed md:max-h-[350px] overflow-y-auto">
          {sqlCode}
        </pre>
      </div>
    </div>
  );
}
