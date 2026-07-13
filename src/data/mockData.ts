import { Portfolio, PortfolioHolding, TradeHistory, PortfolioHistory, Profile, SubscriptionTier } from '../types';
import masterDb from './db.json';

const KEYS = {
  CURRENT_USER: 'current_user_session_v3',
  LOCAL_DB: 'modelportfolio_db_state_v1'
};

// Local storage session of the logged-in user of the browser
export const getCurrentUser = (): Profile | null => {
  try {
    const raw = localStorage.getItem(KEYS.CURRENT_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setCurrentUserSession = (user: Profile | null) => {
  if (user) {
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(KEYS.CURRENT_USER);
  }
};

interface DatabaseSchema {
  portfolios: Portfolio[];
  holdings: PortfolioHolding[];
  trades: TradeHistory[];
  history: PortfolioHistory[];
  profiles: Profile[];
  settings?: {
    paywalls_enabled: boolean;
  };
}

// Client-side Database Getter
export const getLocalDb = (): DatabaseSchema => {
  try {
    const raw = localStorage.getItem(KEYS.LOCAL_DB);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.portfolios)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading localStorage DB', e);
  }

  // Seeding
  const seedImage: DatabaseSchema = {
    portfolios: (masterDb.portfolios as any) || [],
    holdings: (masterDb.holdings as any) || [],
    trades: (masterDb.trades as any) || [],
    history: (masterDb.history as any) || [],
    profiles: (masterDb.profiles as any) || [],
    settings: (masterDb.settings as any) || { paywalls_enabled: false }
  };
  try {
    localStorage.setItem(KEYS.LOCAL_DB, JSON.stringify(seedImage));
  } catch (e) {
    console.error('Error seeding localStorage DB', e);
  }
  return seedImage;
};

// Client-side Database Saver (also auto-syncs to server disk file in development)
export const saveLocalDb = (db: DatabaseSchema) => {
  try {
    localStorage.setItem(KEYS.LOCAL_DB, JSON.stringify(db));
  } catch (e) {
    console.error('Error saving localStorage DB', e);
  }

  // Background fire-and-forget sync to update the persistent workspace db.json file
  fetch('/api/admin/sync-db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(db)
  }).catch(() => {
    // Graceful catch for static environments like Vercel
  });
};

// Helper to merge local database with server database to avoid overwriting or losing changes
export const mergeAndSyncDatabases = (local: DatabaseSchema, server: DatabaseSchema): DatabaseSchema => {
  if (!local.portfolios || local.portfolios.length === 0) {
    return server;
  }

  const mergeById = <T extends { id: any }>(localItems: T[], serverItems: T[]): T[] => {
    const list = [...localItems];
    const localIds = new Set(localItems.map(item => String(item.id)));
    for (const item of serverItems) {
      if (!localIds.has(String(item.id))) {
        list.push(item);
      }
    }
    return list;
  };

  const mergedPortfolios = mergeById(local.portfolios, server.portfolios);
  const mergedHoldings = mergeById(local.holdings || [], server.holdings || []);
  const mergedTrades = mergeById(local.trades || [], server.trades || []);
  const mergedHistory = mergeById(local.history || [], server.history || []);
  
  const mergedProfiles = [...(local.profiles || [])];
  const localEmails = new Set((local.profiles || []).map(p => p.email.toLowerCase().trim()));
  for (const p of (server.profiles || [])) {
    if (!localEmails.has(p.email.toLowerCase().trim())) {
      mergedProfiles.push(p);
    }
  }

  const mergedSettings = local.settings || server.settings || { paywalls_enabled: false };

  return {
    portfolios: mergedPortfolios,
    holdings: mergedHoldings,
    trades: mergedTrades,
    history: mergedHistory,
    profiles: mergedProfiles,
    settings: mergedSettings
  };
};

// 1. Fetch App Data (Reads from server first to try and get new updates, falls back to local storage on static builds)
export const fetchAppData = async (): Promise<DatabaseSchema> => {
  const localDb = getLocalDb();
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const serverDb = await res.json();
      const merged = mergeAndSyncDatabases(localDb, serverDb);
      
      saveLocalDb(merged);
      
      // If local state had portfolios or trades the server doesn't have yet, upload to server to keep db.json updated
      const localHasMore = 
        merged.portfolios.length !== serverDb.portfolios.length || 
        merged.holdings.length !== serverDb.holdings.length || 
        merged.trades.length !== serverDb.trades.length || 
        merged.history.length !== serverDb.history.length;

      if (localHasMore) {
        try {
          await fetch('/api/admin/sync-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged)
          });
        } catch (syncErr) {
          console.warn('Could not sync local database additions to server on load:', syncErr);
        }
      }
      return merged;
    }
  } catch (err) {
    console.warn('Backend server not directly accessible in fetchAppData - standard static hosting behaviour. Reading browser database instead.');
  }
  return localDb;
};

// 2. Global Paywall & App Settings Modifier
export const updateAppSettings = async (paywalls_enabled: boolean): Promise<{ success: boolean; settings: { paywalls_enabled: boolean } }> => {
  const db = getLocalDb();
  if (!db.settings) db.settings = { paywalls_enabled: false };
  db.settings.paywalls_enabled = paywalls_enabled;
  saveLocalDb(db);

  try {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paywalls_enabled })
    });
  } catch (e) {
    console.warn('Could not sync app settings modify to server:', e);
  }

  return { success: true, settings: { paywalls_enabled } };
};

// 3. Login Profile Finder
export const loginUser = async (email: string): Promise<Profile> => {
  const cleanEmail = email.toLowerCase().trim();
  const db = getLocalDb();
  let found = db.profiles.find(p => p.email.toLowerCase().trim() === cleanEmail);

  if (!found) {
    // Attempt backend sync in case the user registered in another browser (during testing)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          db.profiles.push(data.profile);
          saveLocalDb(db);
          return data.profile;
        }
      }
    } catch (e) {
      console.warn('Using local login profile database fallback:', e);
    }

    // Auto-onboard user locally
    found = {
      id: 'profile_' + Date.now(),
      email: cleanEmail,
      subscription_tier: cleanEmail === 'admin@modelportfolio.se' ? 'large' : 'none',
      updated_at: new Date().toISOString()
    };
    db.profiles.push(found);
    saveLocalDb(db);
  }

  return found;
};

// 4. Sign Up User (Auto or explicit)
export const signUpUser = async (email: string, tier: SubscriptionTier = 'none'): Promise<Profile> => {
  const cleanEmail = email.toLowerCase().trim();
  const db = getLocalDb();
  let found = db.profiles.find(p => p.email.toLowerCase().trim() === cleanEmail);

  if (!found) {
    found = {
      id: 'profile_' + Date.now(),
      email: cleanEmail,
      subscription_tier: tier,
      updated_at: new Date().toISOString()
    };
    db.profiles.push(found);
    saveLocalDb(db);
  } else {
    found.subscription_tier = tier;
    found.updated_at = new Date().toISOString();
    saveLocalDb(db);
  }

  try {
    await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, tier })
    });
  } catch (e) {
    console.warn('Could not sync user signup to server:', e);
  }

  return found;
};

// 5. Upgrade/Change subscription tier
export const updateProfileTier = async (email: string, tier: SubscriptionTier): Promise<Profile> => {
  const cleanEmail = email.toLowerCase().trim();
  const db = getLocalDb();
  const found = db.profiles.find(p => p.email.toLowerCase().trim() === cleanEmail);
  if (found) {
    found.subscription_tier = tier;
    found.updated_at = new Date().toISOString();
    saveLocalDb(db);
  }

  try {
    await fetch('/api/auth/profile/tier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, tier })
    });
  } catch (e) {
    console.warn('Could not sync profile tier to server:', e);
  }

  return found || {
    id: 'profile_' + Date.now(),
    email: cleanEmail,
    subscription_tier: tier,
    updated_at: new Date().toISOString()
  };
};

// 6. Create Portfolio
export const addPortfolio = async (portfolio: Omit<Portfolio, 'id'>): Promise<Portfolio> => {
  const db = getLocalDb();
  const newId = 'p_local_' + Date.now();
  const newPortfolio: Portfolio = {
    ...portfolio,
    id: newId
  };

  db.portfolios.push(newPortfolio);
  saveLocalDb(db);

  try {
    const res = await fetch('/api/admin/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(portfolio)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.portfolio) {
        // Swap temp client-side ID with genuine server ID if available
        const index = db.portfolios.findIndex(p => p.id === newId);
        if (index !== -1) {
          db.portfolios[index] = data.portfolio;
          saveLocalDb(db);
          return data.portfolio;
        }
      }
    }
  } catch (e) {
    console.warn('Could not sync created portfolio with server directory:', e);
  }

  return newPortfolio;
};

// 7. Add Buy/Sell transactions or update allocation
export const addTradeAndUpsertHolding_Multi = async (
  portfolioId: string,
  ticker: string,
  type: 'BUY' | 'SELL',
  price: number,
  allocationPct: number,
  analysisText: string,
  companyName: string = '',
  currency: string = 'SEK'
): Promise<{ success: boolean; trade: TradeHistory }> => {
  const db = getLocalDb();

  const newTrade: TradeHistory = {
    id: 't_local_' + Date.now(),
    portfolio_id: portfolioId,
    timestamp: new Date().toISOString(),
    type,
    ticker: ticker.toUpperCase(),
    price: Number(price),
    analysis_text: analysisText,
    currency
  };

  db.trades.push(newTrade);

  if (type === 'BUY') {
    const existingHoldingIndex = db.holdings.findIndex(
      h => h.portfolio_id === portfolioId && h.ticker.toUpperCase() === ticker.toUpperCase()
    );

    if (existingHoldingIndex !== -1) {
      const ext = db.holdings[existingHoldingIndex];
      const totalAlloc = ext.allocation_pct + Number(allocationPct);
      const newAveragePrice = ((ext.avg_purchase_price * ext.allocation_pct) + (Number(price) * Number(allocationPct))) / totalAlloc;

      ext.allocation_pct = Math.min(100, Number(totalAlloc));
      ext.avg_purchase_price = Number(newAveragePrice.toFixed(2));
      ext.current_price = Number(price);
    } else {
      const newHolding: PortfolioHolding = {
        id: 'h_local_' + Date.now(),
        portfolio_id: portfolioId,
        ticker: ticker.toUpperCase(),
        company_name: companyName || ticker.toUpperCase(),
        allocation_pct: Number(allocationPct),
        avg_purchase_price: Number(price),
        current_price: Number(price),
        currency
      };
      db.holdings.push(newHolding);
    }
  } else if (type === 'SELL') {
    const existingHoldingIndex = db.holdings.findIndex(
      h => h.portfolio_id === portfolioId && h.ticker.toUpperCase() === ticker.toUpperCase()
    );

    if (existingHoldingIndex !== -1) {
      const ext = db.holdings[existingHoldingIndex];
      const remainingAlloc = ext.allocation_pct - Number(allocationPct);
      if (remainingAlloc <= 0) {
        db.holdings.splice(existingHoldingIndex, 1);
      } else {
        ext.allocation_pct = Number(remainingAlloc);
      }
    }
  }

  saveLocalDb(db);

  try {
    await fetch('/api/admin/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portfolioId,
        ticker,
        type,
        price,
        allocationPct,
        analysisText,
        companyName,
        currency
      })
    });
  } catch (e) {
    console.warn('Could not sync added trade to server:', e);
  }

  return { success: true, trade: newTrade };
};

// 8. Add Weekly Performance historical points
export const addWeeklyPerformancePoint = async (
  portfolioId: string,
  timestamp: string,
  indexValue: number,
  note: string
): Promise<PortfolioHistory> => {
  const db = getLocalDb();

  const newHistPoint: PortfolioHistory = {
    id: 'ph_local_' + Date.now(),
    portfolio_id: portfolioId,
    timestamp,
    index_value: Number(indexValue),
    note
  };

  db.history.push(newHistPoint);
  saveLocalDb(db);

  try {
    await fetch('/api/admin/weekly-performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portfolioId,
        timestamp,
        indexValue,
        note
      })
    });
  } catch (e) {
    console.warn('Could not sync weekly performance metrics with server:', e);
  }

  return newHistPoint;
};

// 9. Hard database reset
export const resetToDefault = async (): Promise<boolean> => {
  localStorage.removeItem(KEYS.LOCAL_DB);
  getLocalDb(); // Seed again to initial values

  try {
    await fetch('/api/admin/reset', {
      method: 'POST'
    });
  } catch (e) {
    console.warn('Could not sync database reset operation to server:', e);
  }

  return true;
};

// 10. Delete Portfolio
export const deletePortfolio = async (portfolioId: string): Promise<boolean> => {
  const db = getLocalDb();

  db.portfolios = db.portfolios.filter(p => p.id !== portfolioId);
  db.holdings = db.holdings.filter(h => h.portfolio_id !== portfolioId);
  db.trades = db.trades.filter(t => t.portfolio_id !== portfolioId);
  db.history = db.history.filter(h => h.portfolio_id !== portfolioId);

  saveLocalDb(db);

  try {
    await fetch('/api/admin/portfolio/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolioId })
    });
  } catch (e) {
    console.warn('Could not sync portfolio deletion with server:', e);
  }

  return true;
};

// 11. Custom holding editor
export const editHolding = async (
  id: string,
  ticker: string,
  companyName: string,
  allocationPct: number,
  avgPurchasePrice: number,
  currentPrice: number,
  currency: string
): Promise<{ success: boolean; holding?: PortfolioHolding }> => {
  const db = getLocalDb();
  const hIndex = db.holdings.findIndex(h => h.id === id);
  let updatedHolding: PortfolioHolding | undefined;

  if (hIndex !== -1) {
    db.holdings[hIndex] = {
      ...db.holdings[hIndex],
      ticker: ticker.toUpperCase(),
      company_name: companyName,
      allocation_pct: Number(allocationPct),
      avg_purchase_price: Number(avgPurchasePrice),
      current_price: Number(currentPrice),
      currency
    };
    updatedHolding = db.holdings[hIndex];
    saveLocalDb(db);
  }

  try {
    await fetch('/api/admin/holding/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        ticker,
        company_name: companyName,
        allocation_pct: Number(allocationPct),
        avg_purchase_price: Number(avgPurchasePrice),
        current_price: Number(currentPrice),
        currency
      })
    });
  } catch (e) {
    console.warn('Could not sync holding modifications to server:', e);
  }

  return { success: true, holding: updatedHolding };
};

// 12. Delete custom individual holding
export const deleteHolding = async (id: string): Promise<boolean> => {
  const db = getLocalDb();
  db.holdings = db.holdings.filter(h => h.id !== id);
  saveLocalDb(db);

  try {
    await fetch('/api/admin/holding/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  } catch (e) {
    console.warn('Could not sync holding delete operation to server:', e);
  }

  return true;
};

// 13. Create Stripe checkout
export const createStripeCheckoutSession = async (
  tierId: 'small' | 'mid' | 'large',
  email: string
): Promise<{ sessionId?: string; url?: string; error?: string }> => {
  try {
    const successUrl = window.location.origin + window.location.pathname;
    const cancelUrl = window.location.origin + window.location.pathname;
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tierId, email, successUrl, cancelUrl })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      return { sessionId: data.sessionId, url: data.url };
    }
    return { error: data.error || 'Misslyckades att initiera Stripe-betalning (Stripe kan sakna miljövariabler i .env)' };
  } catch (err) {
    return { error: 'Gick inte att ansluta till betalningsservern.' };
  }
};

// 14. Create Stripe client portal
export const createStripePortalSession = async (
  email: string
): Promise<{ url?: string; error?: string }> => {
  try {
    const returnUrl = window.location.origin + window.location.pathname;
    const res = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, returnUrl })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      return { url: data.url };
    }
    return { error: data.error || 'Misslyckades att öppna din Stripe Kundportal' };
  } catch (err) {
    return { error: 'Kopplingsfel mot portalen.' };
  }
};
