import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";

interface Profile {
  id: string;
  email: string;
  subscription_tier: "none" | "small" | "mid" | "large";
  updated_at: string;
}

interface Portfolio {
  id: string;
  name: string;
  description: string;
  category: string;
  risk_profile: string;
  target_subscription_tier: "none" | "small" | "mid" | "large";
  currency?: string;
}

interface PortfolioHolding {
  id: string;
  portfolio_id: string;
  ticker: string;
  company_name: string;
  allocation_pct: number;
  avg_purchase_price: number;
  current_price: number;
  currency?: string;
}

interface TradeHistory {
  id: string;
  portfolio_id: string;
  timestamp: string;
  type: "BUY" | "SELL";
  ticker: string;
  price: number;
  analysis_text: string;
  currency?: string;
}

interface PortfolioHistory {
  id: string;
  portfolio_id: string;
  timestamp: string;
  index_value: number;
  note?: string;
}

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

const DEFAULT_PORTFOLIOS: Portfolio[] = [
  {
    id: 'p1',
    name: 'Svenska Småbolag & Tillväxt',
    description: 'En aktivt förvaltad modellportfölj med svenska tillväxtbolag och småbolag som kombinerar stark vinsttillväxt med hög avkastning på kapital.',
    category: 'Svenska Småbolag',
    risk_profile: 'Hög risk',
    target_subscription_tier: 'small',
    currency: 'SEK'
  },
  {
    id: 'p2',
    name: 'Global High-Dividend Quality',
    description: 'En defensiv korg bestående av globalt marknadsledande storbolag med lång historik av pålitlig och växande direktavkastning.',
    category: 'Globala Utdelningsaktier',
    risk_profile: 'Låg-Medel risk',
    target_subscription_tier: 'small',
    currency: 'USD'
  }
];

const DEFAULT_HOLDINGS: PortfolioHolding[] = [
  {
    id: 'h1',
    portfolio_id: 'p1',
    ticker: 'VOLV B',
    company_name: 'Volvo AB',
    allocation_pct: 25,
    avg_purchase_price: 270.5,
    current_price: 295.2,
    currency: 'SEK'
  },
  {
    id: 'h2',
    portfolio_id: 'p1',
    ticker: 'INVE B',
    company_name: 'Investor AB',
    allocation_pct: 30,
    avg_purchase_price: 248.0,
    current_price: 286.4,
    currency: 'SEK'
  },
  {
    id: 'h3',
    portfolio_id: 'p1',
    ticker: 'EVO',
    company_name: 'Evolution AB',
    allocation_pct: 15,
    avg_purchase_price: 980.0,
    current_price: 1145.0,
    currency: 'SEK'
  },
  {
    id: 'h4',
    portfolio_id: 'p1',
    ticker: 'ATCO A',
    company_name: 'Atlas Copco AB',
    allocation_pct: 20,
    avg_purchase_price: 162.0,
    current_price: 184.8,
    currency: 'SEK'
  },
  {
    id: 'h5',
    portfolio_id: 'p1',
    ticker: 'AZN',
    company_name: 'AstraZeneca PLC',
    allocation_pct: 10,
    avg_purchase_price: 1240.0,
    current_price: 1320.0,
    currency: 'SEK'
  },
  {
    id: 'h6',
    portfolio_id: 'p2',
    ticker: 'MSFT',
    company_name: 'Microsoft Corp',
    allocation_pct: 25,
    avg_purchase_price: 410.5,
    current_price: 423.6,
    currency: 'USD'
  },
  {
    id: 'h7',
    portfolio_id: 'p2',
    ticker: 'NOVO B',
    company_name: 'Novo Nordisk A/S',
    allocation_pct: 20,
    avg_purchase_price: 850.0,
    current_price: 890.3,
    currency: 'DKK'
  },
  {
    id: 'h8',
    portfolio_id: 'p2',
    ticker: 'NEST',
    company_name: 'Nestlé S.A.',
    allocation_pct: 15,
    avg_purchase_price: 94.2,
    current_price: 91.8,
    currency: 'CHF'
  },
  {
    id: 'h9',
    portfolio_id: 'p2',
    ticker: 'KO',
    company_name: 'The Coca-Cola Co',
    allocation_pct: 20,
    avg_purchase_price: 58.4,
    current_price: 61.2,
    currency: 'USD'
  },
  {
    id: 'h10',
    portfolio_id: 'p2',
    ticker: 'REXT',
    company_name: 'Realty Income Corp',
    allocation_pct: 20,
    avg_purchase_price: 52.1,
    current_price: 54.5,
    currency: 'USD'
  }
];

const DEFAULT_TRADES: TradeHistory[] = [
  {
    id: 't1',
    portfolio_id: 'p1',
    timestamp: '2026-05-24T14:30:00Z',
    type: 'BUY',
    ticker: 'VOLV B',
    price: 270.5,
    analysis_text: 'Volvo AB displays strong pricing power, resilient demand in the heavy commercial vehicles sector, and a very robust order book. With a forward dividend yield of over 6% and solid net cash balance, this represents a low-risk, high-quality industrial compounder. The valuation at P/E 11.5x is highly attractive.',
    currency: 'SEK'
  },
  {
    id: 't2',
    portfolio_id: 'p1',
    timestamp: '2026-04-18T09:15:00Z',
    type: 'BUY',
    ticker: 'INVE B',
    price: 248.0,
    analysis_text: 'Investor AB offers premier exposure to the best of Swedish industry (Atlas Copco, SEB, ABB, AstraZeneca) alongside an outstanding unlisted portfolio (Patricia Industries). We initiated this position at an attractive Net Asset Value (NAV) discount of 16.5%, allowing us to buy top-tier compounding assets at deep discounts.',
    currency: 'SEK'
  },
  {
    id: 't3',
    portfolio_id: 'p1',
    timestamp: '2026-04-05T11:00:00Z',
    type: 'SELL',
    ticker: 'HM B',
    price: 158.2,
    analysis_text: 'We have liquidated our entire position in H&M. The fast-fashion landscape is undergoing structural shifts with rising cost pressures, direct-from-China digital giants (Temu/Shein) expanding rapidly, and rising inventory levels. Reallocating this capital into higher-conviction industrial leaders.',
    currency: 'SEK'
  },
  {
    id: 't4',
    portfolio_id: 'p1',
    timestamp: '2026-03-12T13:45:00Z',
    type: 'BUY',
    ticker: 'EVO',
    price: 980.0,
    analysis_text: 'Evolution AB is the undisputed digital monopolist of Live Casino gaming. Generating an EBITDA margin exceeding 70% and a free cash flow conversion Rate close to 100%, its business model is unparalleled. Initiating a 15% model allocation following a healthy market correction.',
    currency: 'SEK'
  },
  {
    id: 't5',
    portfolio_id: 'p2',
    timestamp: '2026-05-28T10:00:00Z',
    type: 'BUY',
    ticker: 'MSFT',
    price: 410.5,
    analysis_text: 'Microsoft erbjuder enastående kassaflöden stöttat av ledarskap inom Enterprise SaaS och generativ AI via Azure och Copilot. Trots en premievärdering väger bolagets strukturella vallgravar tungt.',
    currency: 'USD'
  },
  {
    id: 't6',
    portfolio_id: 'p2',
    timestamp: '2026-05-15T09:00:00Z',
    type: 'BUY',
    ticker: 'NOVO B',
    price: 850.0,
    analysis_text: 'Novo Nordisk fortsätter dominera marknaden för GLP-1 (Ozempic/Wegovy). Vi kliver på tåget mitt i en temporär konsolideringsfas då fundamentala tillväxtutsikter förblir monumentala.',
    currency: 'DKK'
  },
  {
    id: 't7',
    portfolio_id: 'p2',
    timestamp: '2026-05-02T16:20:00Z',
    type: 'BUY',
    ticker: 'REXT',
    price: 52.1,
    analysis_text: 'Realty Income ger oss månatlig stabil utdelning. Backas upp av tiotusentals kommersiella fastigheter och trippel-net leasingkontrakt, vilket garanterar kassaflöde även i sämre tider.',
    currency: 'USD'
  }
];

const DEFAULT_HISTORY: PortfolioHistory[] = [
  { id: 'ph1', portfolio_id: 'p1', timestamp: '2026-04-10', index_value: 100.0, note: 'Lansering och fullteckning' },
  { id: 'ph2', portfolio_id: 'p1', timestamp: '2026-04-17', index_value: 103.5, note: 'Börsuppgång stöttas av verkstadsbolag' },
  { id: 'ph3', portfolio_id: 'p1', timestamp: '2026-04-24', index_value: 101.2, note: 'Temporär vinsthemtagning i tekniksektorn' },
  { id: 'ph4', portfolio_id: 'p1', timestamp: '2026-05-01', index_value: 106.8, note: 'Starka kvartalsrapporter lyfter Investor och Volvo' },
  { id: 'ph5', portfolio_id: 'p1', timestamp: '2026-05-08', index_value: 109.4, note: 'Fyller på med ytterligare industriaktier' },
  { id: 'ph6', portfolio_id: 'p1', timestamp: '2026-05-15', index_value: 112.1, note: 'Evolution vinner mark efter starka exportsiffror' },
  { id: 'ph7', portfolio_id: 'p1', timestamp: '2026-05-22', index_value: 110.5, note: 'Smärre sättning på Stockholmsbörsen' },
  { id: 'ph8', portfolio_id: 'p1', timestamp: '2026-05-29', index_value: 116.8, note: 'Starka inköpschefsindex sätter fart på verkstad' },
  { id: 'ph9', portfolio_id: 'p1', timestamp: '2026-06-03', index_value: 119.5, note: 'Utdelningar återinvesteras, nytt all-time high' },
  { id: 'ph10', portfolio_id: 'p2', timestamp: '2026-04-10', index_value: 100.0, note: 'Portföljlansering' },
  { id: 'ph11', portfolio_id: 'p2', timestamp: '2026-04-17', index_value: 100.8, note: 'Dollarn stärks, ger draghjälp till innehaven' },
  { id: 'ph12', portfolio_id: 'p2', timestamp: '2026-04-24', index_value: 101.5, note: 'Stabila kvartalssiffror från Pepsi och Coca-Cola' },
  { id: 'ph13', portfolio_id: 'p2', timestamp: '2026-05-01', index_value: 102.1, note: 'Nestlé uppvisar god organisk tillväxt' },
  { id: 'ph14', portfolio_id: 'p2', timestamp: '2026-05-08', index_value: 101.9, note: 'Fackföreningar pressar marginaler minimalt' },
  { id: 'ph15', portfolio_id: 'p2', timestamp: '2026-05-15', index_value: 103.4, note: 'Novo Nordisk höjer försäljningsprognosen' },
  { id: 'ph16', portfolio_id: 'p2', timestamp: '2026-05-22', index_value: 104.2, note: 'Stabila hyresintäkter för Realty Income höjer förväntan' },
  { id: 'ph17', portfolio_id: 'p2', timestamp: '2026-05-29', index_value: 105.1, note: 'Microsoft expanderar AI-integreringen' },
  { id: 'ph18', portfolio_id: 'p2', timestamp: '2026-06-03', index_value: 106.7, note: 'Senaste räntebeskedet gynnar defensiv avkastning' }
];

const DEFAULT_USERS: Profile[] = [
  {
    id: 'user-ajellvik',
    email: 'ajellvik@gmail.com',
    subscription_tier: 'large',
    updated_at: '2026-06-03T00:00:00Z'
  },
  {
    id: 'user-demo',
    email: 'demo@example.com',
    subscription_tier: 'none',
    updated_at: '2026-06-03T00:00:00Z'
  },
  {
    id: 'admin-user-id',
    email: 'admin@modelportfolio.se',
    subscription_tier: 'large',
    updated_at: '2026-06-03T00:00:00Z'
  }
];

const DB_DIR = path.join(process.cwd(), "src", "data");
const DB_FILE = path.join(DB_DIR, "db.json");

// Ensure DB exists or seed it
function initializeDatabase(): DatabaseSchema {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultData: DatabaseSchema = {
      portfolios: DEFAULT_PORTFOLIOS,
      holdings: DEFAULT_HOLDINGS,
      trades: DEFAULT_TRADES,
      history: DEFAULT_HISTORY,
      profiles: DEFAULT_USERS,
      settings: {
        paywalls_enabled: false
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), "utf8");
    return defaultData;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.settings) {
      parsed.settings = {
        paywalls_enabled: false
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), "utf8");
    }
    return parsed;
  } catch (err) {
    console.error("Failed to parse database file, resetting to seeds", err);
    const defaultData: DatabaseSchema = {
      portfolios: DEFAULT_PORTFOLIOS,
      holdings: DEFAULT_HOLDINGS,
      trades: DEFAULT_TRADES,
      history: DEFAULT_HISTORY,
      profiles: DEFAULT_USERS,
      settings: {
        paywalls_enabled: false
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), "utf8");
    return defaultData;
  }
}

function saveDatabase(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write to database file", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Quick initial check
  let dbData = initializeDatabase();

  // API Endpoints
  app.get("/api/data", (req, res) => {
    dbData = initializeDatabase(); // Reload current state
    res.json(dbData);
  });

  app.post("/api/auth/login", (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const cleanEmail = email.toLowerCase().trim();
    let user = dbData.profiles.find((p) => p.email.toLowerCase() === cleanEmail);
    if (!user) {
      // Auto register
      user = {
        id: `user-${Date.now()}`,
        email: cleanEmail,
        subscription_tier: cleanEmail === "admin@modelportfolio.se" ? "large" : "none",
        updated_at: new Date().toISOString(),
      };
      dbData.profiles.push(user);
      saveDatabase(dbData);
    }
    res.json({ profile: user });
  });

  app.post("/api/auth/signup", (req, res) => {
    const { email, tier } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const cleanEmail = email.toLowerCase().trim();
    let user = dbData.profiles.find((p) => p.email.toLowerCase() === cleanEmail);
    if (user) {
      return res.json({ profile: user });
    }
    user = {
      id: `user-${Date.now()}`,
      email: cleanEmail,
      subscription_tier: tier || "none",
      updated_at: new Date().toISOString(),
    };
    dbData.profiles.push(user);
    saveDatabase(dbData);
    res.json({ profile: user });
  });

  app.post("/api/auth/profile/tier", (req, res) => {
    const { email, tier } = req.body;
    if (!email || !tier) {
      return res.status(400).json({ error: "Email and tier are required" });
    }
    const idx = dbData.profiles.findIndex((p) => p.email.toLowerCase() === email.toLowerCase().trim());
    if (idx >= 0) {
      dbData.profiles[idx].subscription_tier = tier;
      dbData.profiles[idx].updated_at = new Date().toISOString();
      saveDatabase(dbData);
      return res.json({ profile: dbData.profiles[idx] });
    }
    res.status(404).json({ error: "Profile not found" });
  });

  // Admin section: Add trade & upsert holding
  app.post("/api/admin/trade", (req, res) => {
    const { portfolioId, ticker, type, price, allocationPct, analysisText, companyName, currency } = req.body;
    if (!portfolioId || !ticker || !type || price === undefined || allocationPct === undefined) {
      return res.status(400).json({ error: "Missing required trade fields" });
    }

    const newTrade: TradeHistory = {
      id: `t-${Date.now()}`,
      portfolio_id: portfolioId,
      timestamp: new Date().toISOString(),
      type,
      ticker: ticker.toUpperCase(),
      price: Number(price),
      analysis_text: analysisText || "",
      currency: currency || "SEK",
    };

    dbData.trades.push(newTrade);

    const existingHoldingIndex = dbData.holdings.findIndex(
      (h) => h.portfolio_id === portfolioId && h.ticker.toUpperCase() === ticker.toUpperCase()
    );

    if (existingHoldingIndex >= 0) {
      const existing = dbData.holdings[existingHoldingIndex];
      if (type === "BUY") {
        const totalAllocBefore = existing.allocation_pct;
        const totalAllocAfter = allocationPct;
        if (totalAllocAfter > 0) {
          existing.avg_purchase_price = Number(
            ((existing.avg_purchase_price * totalAllocBefore + price * (totalAllocAfter - totalAllocBefore)) / totalAllocAfter).toFixed(2)
          );
        }
        existing.current_price = price;
        existing.allocation_pct = allocationPct;
        existing.currency = currency || existing.currency || "SEK";
      } else {
        existing.allocation_pct = Math.max(0, allocationPct);
        existing.current_price = price;
        existing.currency = currency || existing.currency || "SEK";
      }

      if (existing.allocation_pct === 0) {
        dbData.holdings.splice(existingHoldingIndex, 1);
      } else {
        dbData.holdings[existingHoldingIndex] = existing;
      }
    } else {
      if (type === "BUY" && allocationPct > 0) {
        dbData.holdings.push({
          id: `h-${Date.now()}`,
          portfolio_id: portfolioId,
          ticker: ticker.toUpperCase(),
          company_name: companyName || ticker.toUpperCase() + " Corp",
          allocation_pct: allocationPct,
          avg_purchase_price: price,
          current_price: price,
          currency: currency || "SEK",
        });
      }
    }

    saveDatabase(dbData);
    res.json({ success: true, trade: newTrade });
  });

  // Admin section: Add historical weekly point
  app.post("/api/admin/weekly-performance", (req, res) => {
    const { portfolioId, timestamp, indexValue, note } = req.body;
    if (!portfolioId || !timestamp || indexValue === undefined) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const created: PortfolioHistory = {
      id: `ph-${Date.now()}`,
      portfolio_id: portfolioId,
      timestamp,
      index_value: Number(indexValue),
      note: note || "",
    };

    dbData.history.push(created);
    saveDatabase(dbData);
    res.json({ success: true, historyPoint: created });
  });

  // Admin section: Add portfolio
  app.post("/api/admin/portfolio", (req, res) => {
    const { name, description, category, risk_profile, target_subscription_tier, currency } = req.body;
    if (!name || !description || !category || !risk_profile) {
      return res.status(400).json({ error: "Missing required portfolio fields" });
    }

    const created: Portfolio = {
      id: `p-${Date.now()}`,
      name,
      description,
      category,
      risk_profile,
      target_subscription_tier: target_subscription_tier || "small",
      currency: currency || "SEK",
    };

    dbData.portfolios.push(created);

    // Initial 100 base index value
    dbData.history.push({
      id: `ph-${Date.now()}`,
      portfolio_id: created.id,
      timestamp: new Date().toISOString().split("T")[0],
      index_value: 100.0,
      note: "Startvärde satt",
    });

    saveDatabase(dbData);
    res.json({ success: true, portfolio: created });
  });

  // Overwrite server database with full state from client (syncs workspace files in development)
  app.post("/api/admin/sync-db", (req, res) => {
    const freshDb = req.body;
    if (freshDb && Array.isArray(freshDb.portfolios)) {
      dbData = {
        portfolios: freshDb.portfolios,
        holdings: freshDb.holdings || [],
        trades: freshDb.trades || [],
        history: freshDb.history || [],
        profiles: freshDb.profiles || [],
        settings: freshDb.settings || { paywalls_enabled: false }
      };
      saveDatabase(dbData);
      res.json({ success: true, message: "Database overwritten from client state" });
    } else {
      res.status(400).json({ error: "Invalid database structure sent" });
    }
  });

  // Reset database endpoint
  app.post("/api/admin/reset", (req, res) => {
    const currentPaywallsEnabled = dbData.settings?.paywalls_enabled ?? false;
    dbData = {
      portfolios: DEFAULT_PORTFOLIOS,
      holdings: DEFAULT_HOLDINGS,
      trades: DEFAULT_TRADES,
      history: DEFAULT_HISTORY,
      profiles: DEFAULT_USERS,
      settings: {
        paywalls_enabled: currentPaywallsEnabled
      }
    };
    saveDatabase(dbData);
    res.json({ success: true, message: "Database has been reset to seed values successfully" });
  });

  // Admin section: Update settings
  app.post("/api/admin/settings", (req, res) => {
    const { paywalls_enabled } = req.body;
    dbData.settings = {
      paywalls_enabled: !!paywalls_enabled
    };
    saveDatabase(dbData);
    res.json({ success: true, settings: dbData.settings });
  });

  // Yahoo Finance search tool proxy endpoint
  app.get("/api/yahoo/search", async (req, res) => {
    const query = req.query.q;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: "Query parameter q is required" });
    }

    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Yahoo Finance search returned status ${response.status}`);
      }

      const data: any = await response.json();
      const results = (data.quotes || []).map((quote: any) => ({
        symbol: quote.symbol,
        name: quote.shortname || quote.longname || quote.symbol,
        exchange: quote.exchDisp || quote.exchange || "",
        type: quote.typeDisp || quote.quoteType || ""
      }));

      res.json({ results });
    } catch (err: any) {
      console.error("Yahoo Finance search proxy error:", err);
      // Robust offline/sandbox fallback list
      const fallbackHoldings = [
        { symbol: "VOLV B", name: "Volvo AB", exchange: "STO", type: "Equity" },
        { symbol: "INVE B", name: "Investor AB", exchange: "STO", type: "Equity" },
        { symbol: "EVO", name: "Evolution AB", exchange: "STO", type: "Equity" },
        { symbol: "ATCO A", name: "Atlas Copco AB", exchange: "STO", type: "Equity" },
        { symbol: "AZN", name: "AstraZeneca PLC", exchange: "STO", type: "Equity" },
        { symbol: "MSFT", name: "Microsoft Corp", exchange: "NASDAQ", type: "Equity" },
        { symbol: "NOVO B", name: "Novo Nordisk A/S", exchange: "CPH", type: "Equity" },
        { symbol: "NEST", name: "Nestlé S.A.", exchange: "EBS", type: "Equity" },
        { symbol: "KO", name: "The Coca-Cola Co", exchange: "NYSE", type: "Equity" },
        { symbol: "REXT", name: "Realty Income Corp", exchange: "NYSE", type: "Equity" },
        { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "Equity" },
        { symbol: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ", type: "Equity" },
        { symbol: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ", type: "Equity" },
        { symbol: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ", type: "Equity" },
        { symbol: "NVDA", name: "NVIDIA Corp", exchange: "NASDAQ", type: "Equity" },
      ];
      
      const term = query.toLowerCase();
      const matched = fallbackHoldings.filter(h => 
        h.symbol.toLowerCase().includes(term) || 
        h.name.toLowerCase().includes(term)
      );
      
      res.json({ results: matched, is_fallback: true });
    }
  });

  // Admin section: Delete Portfolio
  app.post("/api/admin/portfolio/delete", (req, res) => {
    const { portfolioId } = req.body;
    if (!portfolioId) {
      return res.status(400).json({ error: "Missing portfolioId" });
    }
    // Remove portfolio
    dbData.portfolios = dbData.portfolios.filter(p => p.id !== portfolioId);
    // Remove related holdings
    dbData.holdings = dbData.holdings.filter(h => h.portfolio_id !== portfolioId);
    // Remove related trades
    dbData.trades = dbData.trades.filter(t => t.portfolio_id !== portfolioId);
    // Remove related historical records
    dbData.history = dbData.history.filter(ph => ph.portfolio_id !== portfolioId);

    saveDatabase(dbData);
    res.json({ success: true });
  });

  // Admin section: Direct Edit Holding/Position
  app.post("/api/admin/holding/edit", (req, res) => {
    const { id, ticker, company_name, allocation_pct, avg_purchase_price, current_price, currency } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Missing holding ID" });
    }
    const idx = dbData.holdings.findIndex(h => h.id === id);
    if (idx < 0) {
      return res.status(404).json({ error: "Holding not found" });
    }

    dbData.holdings[idx] = {
      ...dbData.holdings[idx],
      ticker: (ticker || dbData.holdings[idx].ticker || "").toUpperCase(),
      company_name: company_name !== undefined ? company_name : dbData.holdings[idx].company_name,
      allocation_pct: allocation_pct !== undefined ? Number(allocation_pct) : dbData.holdings[idx].allocation_pct,
      avg_purchase_price: avg_purchase_price !== undefined ? Number(avg_purchase_price) : dbData.holdings[idx].avg_purchase_price,
      current_price: current_price !== undefined ? Number(current_price) : dbData.holdings[idx].current_price,
      currency: currency || dbData.holdings[idx].currency || "SEK"
    };

    saveDatabase(dbData);
    res.json({ success: true, holding: dbData.holdings[idx] });
  });

  // Admin section: Delete Holding/Position
  app.post("/api/admin/holding/delete", (req, res) => {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Missing holding ID" });
    }

    dbData.holdings = dbData.holdings.filter(h => h.id !== id);

    saveDatabase(dbData);
    res.json({ success: true });
  });

  // Stripe payments integration section
  let stripeInstance: Stripe | null = null;
  const getStripe = (): Stripe | null => {
    if (!stripeInstance) {
      let cryptoKey = process.env.STRIPE_SECRET_KEY;
      if (!cryptoKey) {
        return null;
      }
      cryptoKey = cryptoKey.trim().replace(/^['"]|['"]$/g, '');
      if (cryptoKey.startsWith("sk_test_YOUR_STRIPE") || cryptoKey === "") {
        return null;
      }
      try {
        stripeInstance = new Stripe(cryptoKey, {
          apiVersion: "2023-10-16" as any,
        });
      } catch (err) {
        console.error("Failed to initialize Stripe:", err);
      }
    }
    return stripeInstance;
  };

  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    const { tierId, email, successUrl, cancelUrl } = req.body;
    if (!tierId || !email) {
      return res.status(400).json({ error: "Missing required parameters: tierId, email" });
    }

    const stripe = getStripe();
    if (!stripe) {
      return res.status(400).json({
        error: "Stripe is not configured on the server. Please supply STRIPE_SECRET_KEY in your .env file."
      });
    }

    // Retrieve config key for this tier from environment variables
    let configKey = "";
    if (tierId === "small") {
      configKey = process.env.STRIPE_PRICE_SMALL || process.env.VITE_STRIPE_PRICE_SMALL || "";
    } else if (tierId === "mid") {
      configKey = process.env.STRIPE_PRICE_MID || process.env.VITE_STRIPE_PRICE_MID || "";
    } else if (tierId === "large") {
      configKey = process.env.STRIPE_PRICE_LARGE || process.env.VITE_STRIPE_PRICE_LARGE || "";
    }

    if (!configKey) {
      return res.status(400).json({
        error: `Stripe ID for tier "${tierId}" is not configured in your environment settings. Set STRIPE_PRICE_${tierId.toUpperCase()} in your server environment variables.`
      });
    }

    try {
      let resolvedPriceId = configKey.trim();

      // If user supplied a product ID (starts with prod_), automatically look up the active price ID
      if (resolvedPriceId.startsWith("prod_")) {
        const pricesList = await stripe.prices.list({
          product: resolvedPriceId,
          active: true,
          limit: 1,
        });
        if (pricesList.data && pricesList.data.length > 0) {
          resolvedPriceId = pricesList.data[0].id;
        } else {
          return res.status(400).json({
            error: `Product "${configKey}" has no active prices configured in Stripe Dashboard. Create a recurring price first.`
          });
        }
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        customer_email: email.toLowerCase().trim(),
        line_items: [
          {
            price: resolvedPriceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${successUrl || process.env.APP_URL || "http://localhost:3000"}?session_id={CHECKOUT_SESSION_ID}&checkout_success=true&tier=${tierId}`,
        cancel_url: `${cancelUrl || process.env.APP_URL || "http://localhost:3000"}?checkout_cancel=true`,
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (err: any) {
      console.error("Stripe Checkout Session Error:", err);
      res.status(500).json({ error: err.message || "Internt fel vid kontakt med Stripe." });
    }
  });

  app.post("/api/stripe/create-portal-session", async (req, res) => {
    const { email, returnUrl } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Missing email parameter" });
    }

    const stripe = getStripe();
    if (!stripe) {
      return res.status(400).json({ error: "Stripe is not configured on the server." });
    }

    try {
      const customers = await stripe.customers.list({
        email: email.toLowerCase().trim(),
        limit: 1,
      });

      if (!customers.data || customers.data.length === 0) {
        return res.status(400).json({
          error: "Ingen aktiv kund hittades med din e-post. Köp en prenumeration först!"
        });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customers.data[0].id,
        return_url: returnUrl || process.env.APP_URL || "http://localhost:3000",
      });

      res.json({ url: portalSession.url });
    } catch (err: any) {
      console.error("Stripe Portal Error:", err);
      res.status(500).json({ error: err.message || "Kunde inte skapa Stripe Portal Session." });
    }
  });

  // Vite development server / production routing setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully operational on http://localhost:${PORT}`);
  });
}

startServer();
