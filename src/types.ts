/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SubscriptionTier = 'none' | 'small' | 'mid' | 'large';

export interface Profile {
  id: string;
  email: string;
  subscription_tier: SubscriptionTier;
  updated_at: string;
}

export interface Portfolio {
  id: string;
  name: string;
  description: string;
  category: string; // e.g. "Svenska Småbolag", "Global High-Yield"
  risk_profile: string; // e.g. "Medel-Hög", "Konservativ"
  target_subscription_tier: SubscriptionTier; // Minimum required
  currency?: string; // e.g. 'SEK', 'USD', 'EUR', etc.
}

export interface PortfolioHolding {
  id: string;
  portfolio_id: string; // Belongs to a portfolio
  ticker: string;
  company_name: string;
  allocation_pct: number;
  avg_purchase_price: number;
  current_price: number;
  currency?: string; // Holding currency
}

export interface TradeHistory {
  id: string;
  portfolio_id: string; // Belongs to a portfolio
  timestamp: string;
  type: 'BUY' | 'SELL';
  ticker: string;
  price: number;
  analysis_text: string;
  currency?: string; // Trade price currency
}

export interface PortfolioHistory {
  id: string;
  portfolio_id: string; // Belongs to a portfolio
  timestamp: string; // Week timestamp
  index_value: number; // Index value (e.g., base of 100 or portfolio value)
  note?: string; // Optional weekly note on movement
}

export interface UserSession {
  profile: Profile | null;
  isAdmin: boolean;
}
