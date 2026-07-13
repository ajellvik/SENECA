import React, { useState, useEffect } from 'react';
import { env, pipeline } from '@xenova/transformers';

// Force use of remote Hugging Face Hub files and prevent local filesystem/relative path lookups
// which would otherwise hit Vite's dev server and return index.html, causing unexpected '<' JSON token errors.
env.allowLocalModels = false;
env.remoteHost = 'https://hf-mirror.com';
import { 
  ShieldAlert, 
  Send, 
  Database, 
  Activity, 
  TrendingUp, 
  CheckCircle,
  Landmark,
  PlusCircle,
  Calendar,
  Layers,
  FileText,
  Trash2,
  Edit2,
  Sparkles,
  Download,
  X,
  Cpu,
  MessageSquare,
  Search
} from 'lucide-react';
import { PortfolioHolding, TradeHistory, Profile, Portfolio, PortfolioHistory } from '../types';
import { 
  addPortfolio, 
  addTradeAndUpsertHolding_Multi, 
  addWeeklyPerformancePoint,
  deletePortfolio,
  editHolding,
  deleteHolding,
  updateAppSettings,
  getLocalDb
} from '../data/mockData';

interface AdminPanelProps {
  portfolios: Portfolio[];
  portfolioHistory: PortfolioHistory[];
  holdings: PortfolioHolding[];
  trades: TradeHistory[];
  currentUser: Profile | null;
  onRefresh: () => void;
  onReset: () => void;
  setView: (view: string) => void;
  paywallsEnabled: boolean;
}

// Persistent client-side local LLM pipelines cache to survive component unmounts
const localPipelineInstances: Record<string, any> = {};
const localPipelineLoadingPromises: Record<string, any> = {};

const CURRENCY_LIST = ['SEK', 'USD', 'EUR', 'GBP', 'DKK', 'NOK', 'CHF'];

export default function AdminPanel({
  portfolios,
  portfolioHistory,
  holdings,
  trades,
  currentUser,
  onRefresh,
  onReset,
  setView,
  paywallsEnabled
}: AdminPanelProps) {
  // Check if Admin
  const isAdmin = currentUser?.email.toLowerCase() === 'admin@modelportfolio.se';

  // State managers
  const [activeTab, setActiveTabState] = useState<'trades' | 'weekly' | 'new_portfolio' | 'llm'>('trades');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('p1');
  const [successMsg, setSuccessMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  // LLM Playground States
  const [selectedModel, setSelectedModel] = useState<string>('Xenova/la-mini-flan-t5-78m');
  const [temp, setTemp] = useState<string>('0.7');
  const [maxTokens, setMaxTokens] = useState<number>(180);
  const [promptInput, setPromptInput] = useState<string>('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([
    { role: 'assistant', content: 'Welcome to the Seneca Capital Local research playground. Select one of the tiny local model options on the left, load templates, or ask research queries. Because these run 100% locally in your browser (via transformers.js and WebAssembly/ONNX Runtime), your data never leaves your computer, your usage is unlimited, and it is completely free!' }
  ]);
  const [isSending, setIsSending] = useState(false);
  const [llmError, setLlmError] = useState('');

  // Local model loading & file progress tracker states
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadingProgress, setModelLoadingProgress] = useState<number>(0);
  const [modelFilesState, setModelFilesState] = useState<Record<string, { status: string; progress: number; loaded: number; total: number }>>({});

  const togglePaywallSettings = async () => {
    setIsUpdatingSettings(true);
    setSuccessMsg('');
    setFormError('');
    try {
      await updateAppSettings(!paywallsEnabled);
      onRefresh();
      setSuccessMsg(`Gate policy updated: Subscription dynamic blocks are now ${!paywallsEnabled ? "ENABLED (Stripe paywalls in place)" : "DISABLED (Entire application is free to the public)"}`);
    } catch (err: any) {
      setFormError(err.message || 'Could not update gateway settings.');
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const downloadDatabaseJson = () => {
    try {
      const db = getLocalDb();
      const filename = "db.json";
      const jsonStr = JSON.stringify(db, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessMsg("Local sync: db.json generated and downloaded safely. Check this into your public or private GitHub repository for Vercel/Cloud Run synchronization.");
    } catch (err: any) {
      setFormError("Could not compile database file: " + err.message);
    }
  };

  // States for deleting portfolios and managing holdings
  const [isDeletingPortfolio, setIsDeletingPortfolio] = useState(false);
  const [editingHolding, setEditingHolding] = useState<PortfolioHolding | null>(null);
  const [editTicker, setEditTicker] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editAllocation, setEditAllocation] = useState('');
  const [editAvgPrice, setEditAvgPrice] = useState('');
  const [editCurrentPrice, setEditCurrentPrice] = useState('');
  const [editCurrency, setEditCurrency] = useState('SEK');

  const [holdingToDelete, setHoldingToDelete] = useState<PortfolioHolding | null>(null);

  // Setter wrapper to clear form errors on tab switch
  const setActiveTab = (tab: 'trades' | 'weekly' | 'new_portfolio' | 'llm') => {
    setFormError('');
    setActiveTabState(tab);
  };

  // Form states 1: Trade Execution
  const [ticker, setTicker] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [price, setPrice] = useState('');
  const [allocationPct, setAllocationPct] = useState('');
  const [analysisText, setAnalysisText] = useState('');
  const [tradeCurrency, setTradeCurrency] = useState<string>('SEK');

  // Yahoo Finance states for Trade Execution
  const [yahooSearchResults, setYahooSearchResults] = useState<Array<{ symbol: string, name: string, exchange: string, type: string }>>([]);
  const [isSearchingYahoo, setIsSearchingYahoo] = useState(false);
  const [showYahooDropdown, setShowYahooDropdown] = useState(false);

  // Yahoo Finance states for Editing Holding
  const [yahooEditSearchResults, setYahooEditSearchResults] = useState<Array<{ symbol: string, name: string, exchange: string, type: string }>>([]);
  const [isSearchingEditYahoo, setIsSearchingEditYahoo] = useState(false);
  const [showEditYahooDropdown, setShowEditYahooDropdown] = useState(false);

  // Form states 2: Weekly Performance Entry
  const [weeklyDate, setWeeklyDate] = useState(new Date().toISOString().split('T')[0]);
  const [indexValue, setIndexValue] = useState('');
  const [weeklyNote, setWeeklyNote] = useState('');

  // Form states 3: Create New Portfolio
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState('');
  const [pRisk, setPRisk] = useState('Medium Risk');
  const [pTier, setPTier] = useState<'none' | 'small' | 'mid' | 'large'>('small');
  const [pDescription, setPDescription] = useState('');
  const [pCurrency, setPCurrency] = useState('SEK');

  // Fetch lists
  const currentPortfolio = portfolios.find(p => p.id === selectedPortfolioId) || portfolios[0];
  const allHistories = portfolioHistory;

  // Filter systems
  const activeHoldings = holdings.filter(h => h.portfolio_id === currentPortfolio?.id);
  const activeTrades = trades.filter(t => t.portfolio_id === currentPortfolio?.id);
  const activeHistory = allHistories.filter(ph => ph.portfolio_id === currentPortfolio?.id);

  // Hook to keep trade currency matched to portfolio base brand on selection
  useEffect(() => {
    if (currentPortfolio && currentPortfolio.currency) {
      setTradeCurrency(currentPortfolio.currency);
    }
  }, [selectedPortfolioId, currentPortfolio]);

  // Yahoo Finance Live Autocomplete search for Trade Execution Form
  useEffect(() => {
    if (!ticker.trim()) {
      setYahooSearchResults([]);
      setShowYahooDropdown(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearchingYahoo(true);
      try {
        const res = await fetch(`/api/yahoo/search?q=${encodeURIComponent(ticker)}`);
        if (res.ok) {
          const data = await res.json();
          setYahooSearchResults(data.results || []);
          setShowYahooDropdown((data.results || []).length > 0);
        }
      } catch (err) {
        console.error("Error searching Yahoo:", err);
      } finally {
        setIsSearchingYahoo(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [ticker]);

  // Yahoo Finance Live Autocomplete search for Edit Position Form
  useEffect(() => {
    if (!editTicker.trim()) {
      setYahooEditSearchResults([]);
      setShowEditYahooDropdown(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearchingEditYahoo(true);
      try {
        const res = await fetch(`/api/yahoo/search?q=${encodeURIComponent(editTicker)}`);
        if (res.ok) {
          const data = await res.json();
          setYahooEditSearchResults(data.results || []);
          setShowEditYahooDropdown((data.results || []).length > 0);
        }
      } catch (err) {
        console.error("Error searching Yahoo in Edit:", err);
      } finally {
        setIsSearchingEditYahoo(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [editTicker]);

  // Execute Trade
  const handleTradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !currentPortfolio) return;

    const numPrice = parseFloat(price);
    const numAllocation = parseFloat(allocationPct);

    if (isNaN(numPrice) || numPrice < 0) {
      setFormError('Please enter a valid execution price level.');
      return;
    }
    if (isNaN(numAllocation) || numAllocation < 0 || numAllocation > 100) {
      setFormError('Portfolio weight allocation percentage must range between 0% and 100%.');
      return;
    }
    if (!analysisText || analysisText.trim().length < 5) {
      setFormError('Please write an extensive, detailed professional logic dissertation (min 5 symbols).');
      return;
    }

    setFormError('');
    addTradeAndUpsertHolding_Multi(
      currentPortfolio.id,
      ticker.trim().toUpperCase(),
      orderType,
      numPrice,
      numAllocation,
      analysisText.trim(),
      companyName.trim(),
      tradeCurrency
    )
    .then(() => {
      // Reset fields
      setTicker('');
      setCompanyName('');
      setPrice('');
      setAllocationPct('');
      setAnalysisText('');

      onRefresh();
      showBanner('Trade transaction recorded successfully and synced to static db!');
    })
    .catch(err => {
      setFormError(err.message || 'Execution failed to register on state.');
    });
  };

  // Register Weekly performance index point
  const handleWeeklySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!weeklyDate || !indexValue || !currentPortfolio) return;

    const numVal = parseFloat(indexValue);
    if (isNaN(numVal) || numVal < 0) {
      setFormError('Please input a valid positive valuation level.');
      return;
    }

    setFormError('');
    addWeeklyPerformancePoint(
      currentPortfolio.id,
      weeklyDate,
      numVal,
      weeklyNote.trim()
    )
    .then(() => {
      setIndexValue('');
      setWeeklyNote('');
      onRefresh();
      showBanner(`Valuation index level committed successfully for date ${weeklyDate}!`);
    })
    .catch(err => {
      setFormError(err.message || 'Valuation record declined.');
    });
  };

  // Create New Portfolio
  const handlePortfolioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName || !pCategory) return;

    addPortfolio({
      name: pName.trim(),
      description: pDescription.trim(),
      category: pCategory.trim(),
      risk_profile: pRisk,
      target_subscription_tier: pTier,
      currency: pCurrency
    })
    .then((created) => {
      setPName('');
      setPCategory('');
      setPDescription('');
      setPCurrency('SEK');
      
      // Switch active portfolio to newly created
      setSelectedPortfolioId(created.id);
      setActiveTab('trades');
      onRefresh();
      showBanner(`Successfully deployed new model portfolio "${created.name}"!`);
    })
    .catch(err => {
      setFormError(err.message || 'Could not instantiate portfolio.');
    });
  };

  // Deletion logic for portfolio
  const handleDeletePortfolio = () => {
    if (!currentPortfolio) return;
    deletePortfolio(currentPortfolio.id)
      .then(() => {
        setIsDeletingPortfolio(false);
        const remaining = portfolios.filter(p => p.id !== currentPortfolio.id);
        if (remaining.length > 0) {
          setSelectedPortfolioId(remaining[0].id);
        } else {
          setSelectedPortfolioId('');
        }
        onRefresh();
        showBanner(`The portfolio "${currentPortfolio.name}" has been completely deleted.`);
      })
      .catch(err => {
        setFormError(err.message || 'Purging routine failed.');
      });
  };

  const handleOpenEditHolding = (h: PortfolioHolding) => {
    setEditingHolding(h);
    setEditTicker(h.ticker);
    setEditCompanyName(h.company_name);
    setEditAllocation(h.allocation_pct.toString());
    setEditAvgPrice(h.avg_purchase_price.toString());
    setEditCurrentPrice(h.current_price.toString());
    setEditCurrency(h.currency || 'SEK');
  };

  const handleEditHoldingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHolding) return;
    const numAlloc = parseFloat(editAllocation);
    const numAvg = parseFloat(editAvgPrice);
    const numCurr = parseFloat(editCurrentPrice);

    if (isNaN(numAlloc) || numAlloc < 0 || numAlloc > 100) {
      alert('Allocation target must exist between 0 and 100%.');
      return;
    }
    if (isNaN(numAvg) || numAvg < 0) {
      alert('Cost basis must be a positive coordinate.');
      return;
    }
    if (isNaN(numCurr) || numCurr < 0) {
      alert('Current price level must be a positive coordinate.');
      return;
    }

    editHolding(
      editingHolding.id,
      editTicker.toUpperCase().trim(),
      editCompanyName.trim(),
      numAlloc,
      numAvg,
      numCurr,
      editCurrency
    )
    .then(() => {
      setEditingHolding(null);
      onRefresh();
      showBanner(`The position ${editTicker.toUpperCase()} has been adjusted in db.json state.`);
    })
    .catch(err => {
      alert(err.message || 'Failed to preserve changes.');
    });
  };

  const handleDeleteHoldingClick = () => {
    if (!holdingToDelete) return;
    deleteHolding(holdingToDelete.id)
      .then(() => {
        setHoldingToDelete(null);
        onRefresh();
        showBanner(`Position in ${holdingToDelete.ticker} liquidated from sheet.`);
      })
      .catch(err => {
        alert(err.message || 'Holdings release declined.');
      });
  };

  const showBanner = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const useMessageAsThesis = (text: string) => {
    setAnalysisText(text);
    setActiveTab('trades');
    showBanner("Thesis research copied successfully into the trade dispatcher tab!");
  };

  const getOrInitializePipeline = async (modelId: string) => {
    // If we already have it in cache, return it
    if (localPipelineInstances[modelId]) {
      return localPipelineInstances[modelId];
    }

    // If we are currently loading it, wait for that promise
    if (localPipelineLoadingPromises[modelId]) {
      return localPipelineLoadingPromises[modelId];
    }

    setIsModelLoading(true);
    setLlmError('');
    setModelFilesState({});
    setModelLoadingProgress(0);

    const loadPromise = (async () => {
      try {
        const pipe = await pipeline('text2text-generation', modelId, {
          progress_callback: (data: any) => {
            if (!data || !data.file) return;

            setModelFilesState(prev => {
              const updated = {
                ...prev,
                [data.file]: {
                  status: data.status,
                  progress: typeof data.progress === 'number' ? data.progress : (data.status === 'done' ? 100 : 0),
                  loaded: data.loaded || 0,
                  total: data.total || 0,
                }
              };

              // Compute average progress of downloading files
              const files = Object.values(updated) as Array<{ status: string; progress: number; loaded: number; total: number }>;
              let count = 0;
              let overallSum = 0;

              files.forEach((f) => {
                overallSum += f.progress;
                count++;
              });

              const averageProgress = count > 0 ? Math.round(overallSum / count) : 0;
              setModelLoadingProgress(averageProgress);

              return updated;
            });
          }
        });

        localPipelineInstances[modelId] = pipe;
        return pipe;
      } catch (err: any) {
        delete localPipelineLoadingPromises[modelId];
        throw err;
      } finally {
        setIsModelLoading(false);
      }
    })();

    localPipelineLoadingPromises[modelId] = loadPromise;
    return loadPromise;
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptInput.trim() || isSending || isModelLoading) return;

    setLlmError('');
    setIsSending(true);

    const userPromptText = promptInput.trim();
    const userMsg = { role: 'user' as const, content: userPromptText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setPromptInput('');

    // Add placeholder assistant message
    const assistantIndex = updatedMessages.length;
    setMessages(prev => [...prev, { role: 'assistant' as const, content: 'Initializing locally hosted client-side LLM model...' }]);

    try {
      // 1. Load the model directly in-browser
      const pipe = await getOrInitializePipeline(selectedModel);

      setMessages(prev => {
        const copy = [...prev];
        if (copy[assistantIndex]) {
          copy[assistantIndex] = { role: 'assistant', content: 'Running 100% offline WebAssembly/ONNX inference...' };
        }
        return copy;
      });

      // 2. Perform local inference
      const out = await pipe(userPromptText, {
        max_new_tokens: maxTokens || 180,
        temperature: parseFloat(temp) || 0.7,
      });

      const responseText = out[0]?.generated_text || "No response generated.";

      setMessages(prev => {
        const copy = [...prev];
        if (copy[assistantIndex]) {
          copy[assistantIndex] = { role: 'assistant', content: responseText };
        }
        return copy;
      });

    } catch (err: any) {
      console.error("Local inference failed:", err);
      const errorMsg = err.message || "Unknown local execution failure.";
      setLlmError(errorMsg);
      setMessages(prev => {
        const copy = [...prev];
        if (copy[assistantIndex]) {
          copy[assistantIndex] = { 
            role: 'assistant', 
            content: `⚠️ On-device generation failed: ${errorMsg}\n\nNote: If this is the first execution, ensure you have an active internet connection to download and cache the model metadata (~80MB-220MB). Subsequent requests will be fully cached and available offline.` 
          };
        }
        return copy;
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100 mb-4 shadow-sm">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 font-sans tracking-tight">Access Prohibited</h3>
        <p className="text-sm text-slate-500 mt-2 font-sans">
          This system administrative view is restricted. Authenticate with credentials <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-semibold">admin@modelportfolio.se</code> using the top panel to unlock write operations.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 bg-slate-50 min-h-screen font-sans">
      
      {/* Admin header banner */}
      <div className="rounded-2xl bg-slate-850 text-white p-6 md:p-8 mb-8 border border-slate-200 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shrink-0">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest font-mono">
                System Administrator Portal
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Model Portfolios &amp; Allocation Dashboard</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setView('dashboard')}
              className="rounded-xl bg-slate-850 px-4 py-3 text-xs font-bold hover:bg-slate-800 text-slate-800 hover:text-white transition shadow-sm cursor-pointer"
            >
              Back to Client View
            </button>
            <button
              onClick={downloadDatabaseJson}
              className="rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold hover:bg-indigo-500 text-slate-800 hover:text-white transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Download local db.json copy to sync instantly onto GitHub / Vercel"
            >
              <Download className="h-3.5 w-3.5" />
              Sync &amp; Export db.json
            </button>
            <button
              onClick={onReset}
              className="rounded-xl bg-red-950 border border-red-900 pr-3.5 pl-3 py-3 text-xs font-bold hover:bg-red-905 text-red-350 hover:text-white transition cursor-pointer"
            >
              Factory Reset DB
            </button>
          </div>
        </div>
      </div>

      {/* SYSTEM CONFIGURATION BAR (PAYWALL TOGGLE) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-800 shrink-0 border border-slate-200 shadow-inner">
            <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
              Stripe Billing &amp; Subscription Gate configuration
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                paywallsEnabled 
                  ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-250'
              }`}>
                {paywallsEnabled ? 'Gate Enforced' : 'Freemium (Demo Mode)'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Activate to lock portfolio holdings details and analysis cases underneath standard premium payment checkouts. Disable to bypass checkout modals temporarily and allow unrestricted exploration of the database.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center shrink-0">
          <span className="text-xs font-extrabold text-slate-600">Enforce subscriber gate:</span>
          <button
            onClick={togglePaywallSettings}
            disabled={isUpdatingSettings}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              paywallsEnabled ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                paywallsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {successMsg && (
         <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-start gap-3 shadow-md animate-fade-in">
           <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
           <div>
             <span className="font-extrabold block text-sm">System Broadcast</span>
             <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
           </div>
         </div>
      )}

      {/* PORTFOLIO SELECT SECTION FOR EDITING */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
            Select Active Portfolio to Manage:
          </span>
          <div className="flex flex-wrap gap-2.5">
            {portfolios.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPortfolioId(p.id)}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  p.id === selectedPortfolioId
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5" />
                  <span>{p.name} {p.currency ? `(${p.currency})` : ''}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {currentPortfolio && (
          <div className="flex shrink-0 self-start md:self-center">
            <button
              onClick={() => setIsDeletingPortfolio(true)}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 px-3.5 py-2.5 text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Portfolio</span>
            </button>
          </div>
        )}
      </div>

      {/* ADMINISTRATIVE NAVIGATION CONTROL TABS */}
      <div className="flex border-b border-slate-250 mb-8 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('trades')}
          className={`pb-3.5 px-4 text-xs font-bold transition shrink-0 border-b-2 -mb-[2px] cursor-pointer ${
            activeTab === 'trades'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Trade Dispatcher (BUY/SELL)
          </div>
        </button>
        <button
          onClick={() => setActiveTab('weekly')}
          className={`pb-3.5 px-4 text-xs font-bold transition shrink-0 border-b-2 -mb-[2px] cursor-pointer ${
            activeTab === 'weekly'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Performance Valuation Points
          </div>
        </button>
        <button
          onClick={() => setActiveTab('new_portfolio')}
          className={`pb-3.5 px-4 text-xs font-bold transition shrink-0 border-b-2 -mb-[2px] cursor-pointer ${
            activeTab === 'new_portfolio'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Instantiate New Portfolio
          </div>
        </button>
        <button
          onClick={() => setActiveTab('llm')}
          className={`pb-3.5 px-4 text-xs font-bold transition shrink-0 border-b-2 -mb-[2px] cursor-pointer ${
            activeTab === 'llm'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            AI Co-generation Playground
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Dynamic workflow module display container */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          
          {/* TAB 1: LOG TRADES */}
          {activeTab === 'trades' && (
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-6">
                <Send className="h-4.5 w-4.5 text-indigo-600" />
                Dispatch trade transaction for "{currentPortfolio?.name}"
              </h3>

              <form onSubmit={handleTradeSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 font-mono">
                      Asset Ticker / Symbol *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. AAPL or VOLV-B.ST"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        onFocus={() => ticker && setShowYahooDropdown(true)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-10 text-sm text-slate-900 focus:border-[#c35232] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#c35232] transition font-mono uppercase"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {isSearchingYahoo ? (
                          <span className="h-4 w-4 rounded-full border-2 border-[#c35232] border-t-transparent animate-spin" />
                        ) : (
                          <Search className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {showYahooDropdown && yahooSearchResults.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl">
                        <div className="px-2.5 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[#c35232] border-b border-stone-100 bg-[#fdf5f2] flex justify-between items-center rounded-t-lg">
                          <span>Yahoo Finance Search Results</span>
                          <button 
                            type="button" 
                            onClick={() => setShowYahooDropdown(false)}
                            className="text-stone-400 hover:text-[#c35232] transition cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        {yahooSearchResults.map((res) => (
                          <button
                            key={res.symbol}
                            type="button"
                            onClick={() => {
                              setTicker(res.symbol);
                              setCompanyName(res.name);
                              setShowYahooDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fdf5f2] transition duration-100 flex justify-between items-center group cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-mono font-bold text-xs text-stone-900 group-hover:text-[#c35232] block">
                                {res.symbol}
                              </span>
                              <span className="text-[10px] text-stone-500 truncate block mt-0.5">
                                {res.name}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-[8px] font-bold text-stone-600 uppercase font-mono">
                                {res.exchange || 'EQUITY'}
                              </span>
                              <span className="text-[8px] text-stone-400 block mt-0.5 uppercase font-mono">
                                {res.type || 'Stock'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Company Legal Name (For Buy actions)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Investor AB"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-[#c35232] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#c35232] transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Trade Action Type *
                    </label>
                    <select
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value as 'BUY' | 'SELL')}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition font-semibold"
                    >
                      <option value="BUY">BUY (Acquire)</option>
                      <option value="SELL">SELL (Liquidate)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Price Currency *
                    </label>
                    <select
                      value={tradeCurrency}
                      onChange={(e) => setTradeCurrency(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition font-mono font-bold"
                    >
                      {CURRENCY_LIST.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Price level ({tradeCurrency}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder={`Price in ${tradeCurrency}`}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Portfolio Weight % *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      required
                      placeholder="0.0 - 100"
                      value={allocationPct}
                      onChange={(e) => setAllocationPct(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Investment thesis &amp; Research Memorandum (Subscriber analysis) *
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Provide a professional financial thesis with catalysts, competitive advantages, valuation metrics, and portfolio integration facts..."
                    value={analysisText}
                    onChange={(e) => setAnalysisText(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition text-slate-705 leading-relaxed"
                  ></textarea>
                </div>

                {formError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-red-600 hover:bg-red-700 py-3 text-sm font-bold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-red-500/10 cursor-pointer"
                >
                  Post Trade Transaction &amp; Notify Subscribers
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: WEEKLY PRICE / INDEX UPDATE */}
          {activeTab === 'weekly' && (
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-2">
                <Calendar className="h-4.5 w-4.5 text-indigo-600" />
                Commit historical performance metric for "{currentPortfolio?.name}"
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Populate the graphic performance engine by submitting a snapshot valuation point (where the base index typically starts at 100 on inception).
              </p>

              <form onSubmit={handleWeeklySubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Effective Valuation Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={weeklyDate}
                      onChange={(e) => setWeeklyDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Index Level / Asset Value (relative to start 100)*
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 119.5"
                      value={indexValue}
                      onChange={(e) => setIndexValue(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Valuation Catalyst Commentary (Public Narrative)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Short summary describing weekly allocations or corporate catalysts (e.g. 'Stellar Q1 reports from Investor AB and Volvo AB drive outperformance'). This is displayed on the public marketing chart."
                    value={weeklyNote}
                    onChange={(e) => setWeeklyNote(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition leading-relaxed text-slate-700"
                  ></textarea>
                 </div>

                {formError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-red-600 hover:bg-red-700 py-3 text-sm font-bold text-white transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl cursor-pointer"
                >
                  Commit Weekly Metric
                </button>
              </form>

              {/* LIST OF ALREADY LOGGED WEEKS */}
              <div className="mt-8 border-t pt-6">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">
                  Registered Performance History Points ({activeHistory.length})
                </h4>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {activeHistory.slice().reverse().map((h) => (
                    <div key={h.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg text-xs border border-slate-100">
                      <div>
                        <span className="font-bold text-slate-800">{h.timestamp}</span>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{h.note}</p>
                      </div>
                      <span className="font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-150 font-bold">
                        {h.index_value.toFixed(1)} level
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CREATE PORTFOLIO */}
          {activeTab === 'new_portfolio' && (
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-6">
                <PlusCircle className="h-4.5 w-4.5 text-indigo-600" />
                Instantiate and Deploy new Model Portfolio
              </h3>

              <form onSubmit={handlePortfolioSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Portfolio Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. European Growth Leaders"
                      value={pName}
                      onChange={(e) => setPName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Sector / Core Focus *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Industrial Automation"
                      value={pCategory}
                      onChange={(e) => setPCategory(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Risk Classification *
                    </label>
                    <select
                      value={pRisk}
                      onChange={(e) => setPRisk(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition font-medium"
                    >
                      <option value="High Risk">High Risk</option>
                      <option value="Medium-High Risk">Medium-High Risk</option>
                      <option value="Medium Risk">Medium Risk</option>
                      <option value="Low-Medium Risk">Low-Medium Risk</option>
                      <option value="Low Risk">Low Risk</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Required Access Tier *
                    </label>
                    <select
                      value={pTier}
                      onChange={(e) => setPTier(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition font-medium"
                    >
                      <option value="small">Basic (Small)</option>
                      <option value="mid">Standard (Mid)</option>
                      <option value="large">Premium (Large)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Portfolio Base Currency *
                    </label>
                    <select
                      value={pCurrency}
                      onChange={(e) => setPCurrency(e.target.value)}
                      className="w-full rounded-lg border border-slate-205 bg-slate-50 py-2.5 px-3 text-sm text-slate-990 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition font-medium"
                    >
                      {CURRENCY_LIST.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Investment Mandate &amp; Absolute Philosophy *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe the index definition, selection universe, weighting criteria, and rebalancing interval parameters..."
                    value={pDescription}
                    onChange={(e) => setPDescription(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 transition leading-relaxed text-slate-705"
                  ></textarea>
                </div>

                {formError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-sm font-bold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
                >
                  Deploy Model Portfolio to DB.json
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: AI CO-GENERATION PLAYGROUND */}
          {activeTab === 'llm' && (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
                    Interactive Local-First Quantitative Analyst AI Playground
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    Powered by browser-resident transformers.js, running entirely on-device via WebAssembly/ONNX Runtime. Draft investment theses, compile macro catalysts, and co-generate stock write-ups completely for free, offline, with absolute client-side privacy.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMessages([
                      { role: 'assistant', content: 'Conversation thread clear. Select one of the responsive local model foot-prints or submit custom queries.' }
                    ]);
                    setLlmError('');
                  }}
                  className="rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-3 py-1.5 text-xs text-slate-600 font-bold transition flex items-center gap-1 bg-white cursor-pointer"
                >
                  Clear Chat Thread
                </button>
              </div>

              {/* TWO PANEL INTERFACE */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* CONFIGURATION SIDEBAR panel (cols: 4) */}
                <div className="md:col-span-4 space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                    
                    {/* model selector */}
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Select Tiny Local Model Footprint:
                      </label>
                      <select
                        value={selectedModel}
                        onChange={(e) => {
                          setSelectedModel(e.target.value);
                          setLlmError('');
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 transition font-medium"
                      >
                        <option value="Xenova/la-mini-flan-t5-78m">Flan-T5 LaMini-78M (Recommended, ~80MB)</option>
                        <option value="Xenova/flan-t5-small">HuggingFace Flan-T5 Small (~150MB)</option>
                        <option value="Xenova/la-mini-flan-t5-248m">Flan-T5 LaMini-248M (Detailed, ~240MB)</option>
                      </select>
                    </div>

                    {/* temperature selector */}
                    <div>
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 font-mono font-extrabold">
                        <span>Temperature:</span>
                        <span className="font-bold text-indigo-600">{temp}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={temp}
                        onChange={(e) => setTemp(e.target.value)}
                        className="w-full accent-indigo-600 h-1 rounded-lg cursor-pointer bg-slate-200"
                      />
                      <div className="flex justify-between text-[8px] text-slate-400 font-mono mt-1">
                        <span>Focused (0.1)</span>
                        <span>Creative (1.0)</span>
                      </div>
                    </div>

                    {/* max tokens selector */}
                    <div>
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 font-mono font-extrabold">
                        <span>Max Response Tokens:</span>
                        <span className="font-bold text-indigo-600">{maxTokens}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="512"
                        step="10"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                        className="w-full accent-indigo-600 h-1 rounded-lg cursor-pointer bg-slate-200"
                      />
                      <div className="flex justify-between text-[8px] text-slate-400 font-mono mt-1">
                        <span>Short (50)</span>
                        <span>Dense (512)</span>
                      </div>
                    </div>

                    {/* Model download loader panel */}
                    {isModelLoading && (
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2.5 text-xs animate-fade-in shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-indigo-950 font-mono text-[9px] uppercase flex items-center gap-1.5">
                            <Cpu className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                            Streaming Model Parameters...
                          </span>
                          <span className="font-mono text-[10px] font-extrabold text-indigo-700">{modelLoadingProgress}%</span>
                        </div>
                        <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${modelLoadingProgress}%` }}
                          ></div>
                        </div>
                        <div className="text-[8px] text-indigo-700 font-mono leading-relaxed max-h-32 overflow-y-auto space-y-1 bg-white/40 p-1.5 rounded border border-indigo-50">
                          {Object.keys(modelFilesState).length === 0 ? (
                            <div className="italic text-slate-400">Loading model file structure...</div>
                          ) : (
                            Object.entries(modelFilesState).map(([file, info]) => {
                              const cleanName = file.split('/').pop() || file;
                              const fileInfo = info as { status: string; progress: number; loaded: number; total: number };
                              return (
                                <div key={file} className="flex justify-between gap-4 py-0.5 border-b border-indigo-50/50 last:border-0">
                                  <span className="truncate max-w-[120px]" title={file}>{cleanName}</span>
                                  <span className="shrink-0 font-bold">
                                    {fileInfo.status === 'done' ? '✓ Ready' : `loading (${fileInfo.progress}%)`}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* fast templates widgets */}
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                        Analyst Inspiration Presets:
                      </label>
                      <div className="space-y-2">
                        {[
                          {
                            label: "Draft Investment Thesis",
                            prompt: "List Sweden's top 3 investment compounders (e.g. Investor AB, Volvo) and summary SWOT bullet points."
                          },
                          {
                            label: "Macro interest trajectories",
                            prompt: "Summarize how Sweden Riksbank policy interest rate moves affect market equity risk premiums."
                          },
                          {
                            label: "Index weight justification",
                            prompt: "Explain why portfolio diversification with low covariance is preferred for high-conviction dividend compounder stocks."
                          }
                        ].map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPromptInput(p.prompt)}
                            disabled={isSending || isModelLoading}
                            className="w-full text-left p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition text-[10px] leading-relaxed text-slate-700 cursor-pointer font-medium disabled:opacity-50"
                          >
                            <span className="font-bold text-slate-900 block font-mono text-[9px] uppercase text-indigo-700 mb-0.5">
                              {p.label}
                            </span>
                            <span className="line-clamp-2 text-slate-500 font-sans">{p.prompt}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-400 font-mono leading-relaxed pt-2 border-t border-slate-200">
                      Note: On-device execution speeds depend on your browser hardware capabilities and WebAssembly multithreading options. Compiled models are stored locally within HuggingFace Cache APIs.
                    </div>
                  </div>
                </div>

                {/* ACTIVE CHAT WORKSPACE (cols: 8) */}
                <div className="md:col-span-8 flex flex-col h-[500px] border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                  
                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((m, idx) => {
                      const isUser = m.role === 'user';
                      return (
                        <div
                          key={idx}
                          className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                              isUser
                                ? 'bg-slate-900 text-white rounded-tr-none'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-2 border-b pb-1.5 font-mono text-[9px] text-slate-400">
                              <span className="font-semibold">{isUser ? 'ADMINISTRATOR' : 'QUANT ANALYST AI'}</span>
                              <span className="opacity-60">|</span>
                              <span>{isUser ? 'Query' : selectedModel}</span>
                            </div>
                            
                            <p className="whitespace-pre-wrap font-sans leading-relaxed text-left">
                              {m.content}
                            </p>

                            {!isUser && m.content !== '...' && m.content.length > 50 && (
                              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                                  Actions
                                </span>
                                <div className="flex gap-2 text-[9px]">
                                  <button
                                    type="button"
                                    onClick={() => useMessageAsThesis(m.content)}
                                    className="rounded px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-250 font-bold tracking-wider uppercase font-mono cursor-pointer flex items-center gap-1 shadow-sm transition"
                                    title="Move text instantly into trade thesis write-up widget"
                                  >
                                    <Send className="h-2.5 w-2.5" />
                                    Use as Trade Thesis
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(m.content);
                                      showBanner("Text copied cleanly to administrative clipboard!");
                                    }}
                                    className="rounded px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-bold uppercase tracking-wider font-mono cursor-pointer transition select-none animate-fade-in"
                                  >
                                    Copy Raw
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {isSending && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-tl-none p-4 text-xs font-mono italic animate-pulse shadow-sm">
                          Analyst pipeline is active, streaming synthesis vectors...
                        </div>
                      </div>
                    )}

                    {llmError && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-mono font-medium text-left">
                        {llmError}
                      </div>
                    )}
                  </div>

                  {/* Input form */}
                  <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
                    <input
                      type="text"
                      value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask the analyst helper a research query..."
                      disabled={isSending}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-xs focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 transition text-slate-800 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={isSending || !promptInput.trim()}
                      className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-widest text-[10px] uppercase font-mono px-4 duration-150 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 select-none"
                    >
                      <span>SEND</span>
                      <Send className="h-3 w-3" />
                    </button>
                  </div>

                </div>

              </div>
            </div>
          )}

        </div>

        {/* Database Stats Panel */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Database className="h-4 w-4 text-slate-400" />
              Active Holdings ({activeHoldings.length})
            </h4>
            
            {activeHoldings.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 italic">
                No active holdings registered in database.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {activeHoldings.map((h) => (
                  <div key={h.id} className="group flex items-center justify-between p-3 bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-xl text-xs transition relative">
                    <div className="flex flex-col max-w-[55%]">
                      <span className="font-bold text-slate-900 truncate">{h.company_name}</span>
                      <span className="font-mono text-[10px] text-slate-400">{h.ticker}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-extrabold text-slate-805 block font-mono leading-none mb-1">{h.allocation_pct}%</span>
                        <span className="text-[9px] text-slate-400 font-mono block">{h.current_price} {h.currency || 'SEK'}</span>
                      </div>
                      <div className="flex items-center gap-1 border-l border-slate-200 pl-2 shrink-0 animate-fade-in hover:scale-105">
                        <button
                          onClick={() => handleOpenEditHolding(h)}
                          title="Edit Position"
                          className="h-7 w-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-650 hover:text-indigo-600 transition shadow-sm cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setHoldingToDelete(h)}
                          title="Liquidate Position"
                          className="h-7 w-7 flex items-center justify-center rounded-lg bg-white border border-red-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition shadow-sm cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-slate-400" />
              Transactions Archive ({activeTrades.length})
            </h4>
            
            {activeTrades.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 italic">
                No trades registered.
              </div>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {activeTrades.slice(0, 5).map((t) => (
                  <div key={t.id} className="p-2 bg-slate-55 border border-slate-100 rounded-md text-[11px] flex justify-between items-center">
                    <div>
                      <span className={`inline-block px-1 py-0.5 rounded text-[8px] font-bold mr-1.5 ${
                        t.type === 'BUY' ? 'bg-emerald-100 text-emerald-850' : 'bg-red-100 text-red-850'
                      }`}>
                        {t.type}
                      </span>
                      <span className="font-bold text-slate-800">{t.ticker}</span>
                    </div>
                    <span className="font-mono text-slate-500 font-semibold">{t.price} {t.currency || 'SEK'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* MODAL 1: CONFIRM DELETE PORTFOLIO */}
      {isDeletingPortfolio && currentPortfolio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 border border-slate-100 shadow-2xl relative animate-fade-in">
            <button 
              onClick={() => setIsDeletingPortfolio(false)}
              className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 mb-5 border border-red-100">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-extrabold tracking-tight">Confirm Deletion?</h3>
            <p className="text-sm text-slate-500 mt-2.5 leading-relaxed">
              Are you absolutely aggregate-sure you want to purge the model portfolio <strong className="text-slate-900">"{currentPortfolio.name}"</strong>? This will release all underlying positions, trades, and performance history coordinates irreversibly.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setIsDeletingPortfolio(false)}
                className="flex-1 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 py-3 text-sm font-semibold transition bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePortfolio}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white py-3 text-sm font-bold shadow-lg shadow-red-500/10 transition cursor-pointer"
              >
                Yes, Purge Portfolio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT HOLDING */}
      {editingHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 border border-slate-100 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setEditingHolding(null)}
              className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
              <Edit2 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-extrabold tracking-tight">Modify Holding</h3>
            <p className="text-xs text-slate-400 mt-1">Manual adjustment inside db.json without generating trade log metrics</p>

            <form onSubmit={handleEditHoldingSubmit} className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Ticker
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={editTicker}
                      onChange={(e) => setEditTicker(e.target.value)}
                      onFocus={() => editTicker && setShowEditYahooDropdown(true)}
                      className="w-full rounded-lg border border-slate-200 py-2 pl-3 pr-8 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#c35232] transition font-mono uppercase"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {isSearchingEditYahoo ? (
                        <span className="h-3 w-3 rounded-full border border-[#c35232] border-t-transparent animate-spin" />
                      ) : (
                        <Search className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {showEditYahooDropdown && yahooEditSearchResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-[200%] max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl">
                      <div className="px-2.5 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[#c35232] border-b border-stone-100 bg-[#fdf5f2] flex justify-between items-center rounded-t-lg">
                        <span>Yahoo Finance Search Results</span>
                        <button 
                          type="button" 
                          onClick={() => setShowEditYahooDropdown(false)}
                          className="text-stone-400 hover:text-[#c35232] transition cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {yahooEditSearchResults.map((res) => (
                        <button
                          key={res.symbol}
                          type="button"
                          onClick={() => {
                            setEditTicker(res.symbol);
                            setEditCompanyName(res.name);
                            setShowEditYahooDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fdf5f2] transition duration-100 flex justify-between items-center group cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-mono font-bold text-xs text-stone-900 group-hover:text-[#c35232] block">
                              {res.symbol}
                            </span>
                            <span className="text-[10px] text-stone-500 truncate block mt-0.5">
                              {res.name}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-[8px] font-bold text-stone-600 uppercase font-mono">
                              {res.exchange || 'EQUITY'}
                            </span>
                            <span className="text-[8px] text-stone-400 block mt-0.5 uppercase font-mono">
                              {res.type || 'Stock'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#c35232] transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Weight %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={editAllocation}
                    onChange={(e) => setEditAllocation(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-slate-50 focus:bg-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Avg Basis Cost
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editAvgPrice}
                    onChange={(e) => setEditAvgPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-slate-50 focus:bg-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Estimated Spot Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editCurrentPrice}
                    onChange={(e) => setEditCurrentPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-slate-50 focus:bg-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Valuation Currency
                </label>
                <select
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-slate-50 focus:outline-none font-bold font-mono"
                >
                  {CURRENCY_LIST.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingHolding(null)}
                  className="flex-1 rounded-xl border border-slate-200 text-slate-700 py-3 text-xs font-semibold hover:bg-slate-50 transition bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white py-3 text-xs font-bold transition cursor-pointer"
                >
                  Commit Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE POSITION/HOLDING */}
      {holdingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 border border-slate-100 shadow-2xl relative animate-fade-in">
            <button 
              onClick={() => setHoldingToDelete(null)}
              className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-55 text-red-650 mb-5 border border-red-100">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-extrabold tracking-tight">Liquidate Position?</h3>
            <p className="text-sm text-slate-500 mt-2.5 leading-relaxed">
              Are you sure you want to completely liquidate <strong className="text-slate-900">{holdingToDelete.company_name} ({holdingToDelete.ticker})</strong>? This releases the dynamic asset snapshot immediately from subscriber balance sheets without touching historical archived trades.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setHoldingToDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 py-3 text-sm font-semibold transition bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteHoldingClick}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white py-3 text-sm font-bold shadow-lg shadow-red-500/10 transition cursor-pointer"
              >
                Yes, Liquidate Position
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
