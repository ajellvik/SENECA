-- Database Schema and Row Level Security (RLS) rules for Supabase / PostgreSQL.
-- Drag and drop this into the Supabase SQL editor to bootstrap your database!

-- 1. Create Profiles Table (Syncs with Supabase Authentication)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  subscription_tier TEXT NOT NULL DEFAULT 'none' CHECK (subscription_tier IN ('none', 'small', 'mid', 'large')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Portfolios Table (Support for multiple portfolios)
CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g. "Svenska Småbolag", "Global Utbytte"
  risk_profile TEXT NOT NULL, -- e.g. "Hög", "Medel"
  target_subscription_tier TEXT NOT NULL DEFAULT 'small' CHECK (target_subscription_tier IN ('none', 'small', 'mid', 'large')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Portfolio Holdings Table (Linked to Portfolios)
CREATE TABLE public.portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  allocation_pct NUMERIC NOT NULL CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  avg_purchase_price NUMERIC NOT NULL CHECK (avg_purchase_price >= 0),
  current_price NUMERIC NOT NULL CHECK (current_price >= 0),
  UNIQUE (portfolio_id, ticker)
);

-- 4. Create Trade History Table (Linked to Portfolios)
CREATE TABLE public.trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  ticker TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  analysis_text TEXT NOT NULL
);

-- 5. Create Portfolio History Table (Support for weekly manual index/performance entries)
-- This table is accessible to guests/none-tier users to run marketing charts!
CREATE TABLE public.portfolio_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  index_value NUMERIC NOT NULL, -- e.g., Base 100 Index value or actual asset value
  note TEXT -- e.g., "Rapportperiod stängd, stark ökning av technehav"
);

-- 6. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_history ENABLE ROW LEVEL SECURITY;

-- 7. Publicly readable tables (so non-paying clients can view portfolio performance lists and graphs)
CREATE POLICY "Anyone can read portfolios" 
  ON public.portfolios FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can read portfolio history performance points" 
  ON public.portfolio_history FOR SELECT TO public USING (true);

-- 8. Profiles Policies
CREATE POLICY "Users can read their own profile" 
  ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 9. Protected Tables Security Policies (PORTFOLIO HOLDINGS)
-- CRITICAL SECURITY: portfolio_holdings CANNOT be read unless the requesting user has subscription_tier NOT 'none'
CREATE POLICY "Allow select on portfolio_holdings for active subscribers" 
  ON public.portfolio_holdings
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.subscription_tier != 'none'
    )
  );

-- 10. Protected Tables Security Policies (TRADE HISTORY)
-- CRITICAL SECURITY: trade_history CANNOT be read unless the requesting user has subscription_tier NOT 'none'
CREATE POLICY "Allow select on trade_history for active subscribers" 
  ON public.trade_history
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.subscription_tier != 'none'
    )
  );

-- 11. Admin-Specific Write Access Override Policies (Write rules for admin email check)
CREATE POLICY "Admin full write on profiles" 
  ON public.profiles FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@modelportfolio.se')
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@modelportfolio.se');

CREATE POLICY "Admin full write on portfolios" 
  ON public.portfolios FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@modelportfolio.se')
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@modelportfolio.se');

CREATE POLICY "Admin full write on portfolio_holdings" 
  ON public.portfolio_holdings FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@modelportfolio.se')
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@modelportfolio.se');

CREATE POLICY "Admin full write on trade_history" 
  ON public.trade_history FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@modelportfolio.se')
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@modelportfolio.se');

CREATE POLICY "Admin full write on portfolio_history" 
  ON public.portfolio_history FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@modelportfolio.se')
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@modelportfolio.se');

-- 12. Automatic Profile Trigger on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, subscription_tier)
  VALUES (new.id, new.email, 'none');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
