import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  CreditCard, 
  Activity, 
  Settings, 
  Shield, 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  Crown,
  Download,
  Terminal,
  User,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Lock,
  ArrowRight,
  Orbit
} from 'lucide-react';

import Header from './components/Header';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import StripeCheckout from './components/StripeCheckout';
import AuthModal from './components/AuthModal';

import {
  getCurrentUser,
  setCurrentUserSession,
  fetchAppData,
  updateProfileTier,
  resetToDefault,
  getLocalDb,
  updateAppSettings
} from './data/mockData';

import { Profile, PortfolioHolding, TradeHistory, Portfolio, PortfolioHistory } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isAntigravityActive, setIsAntigravityActive] = useState<boolean>(false);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [trades, setTrades] = useState<TradeHistory[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioHistory[]>([]);
  const [currentView, setView] = useState<string>('landing');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [checkoutTarget, setCheckoutTarget] = useState<{
    tierId: 'small' | 'mid' | 'large';
    price: number;
    name: string;
  } | null>(null);
  const [paywallsEnabled, setPaywallsEnabled] = useState<boolean>(false);

  // Unified dynamic server-sync method
  const reloadAllData = () => {
    fetchAppData()
      .then(data => {
        setPortfolios(data.portfolios);
        setHoldings(data.holdings);
        setTrades(data.trades);
        setPortfolioHistory(data.history);
        if (data.settings) {
          setPaywallsEnabled(data.settings.paywalls_enabled);
        } else {
          setPaywallsEnabled(false);
        }

        // Sync current profile status with the latest live list on the server
        const sessionUser = getCurrentUser();
        if (sessionUser) {
          const freshProfile = data.profiles.find(p => p.email.toLowerCase() === sessionUser.email.toLowerCase());
          if (freshProfile) {
            setCurrentUser(freshProfile);
            setCurrentUserSession(freshProfile);
          } else {
            setCurrentUser(sessionUser);
          }
        } else {
          // Auto-onboard a default trial user if none exists so they see full interactive state
          const defaultSessionUser: Profile = {
            id: 'trial_user',
            email: 'ajellvik@gmail.com', // Active Swedish domain user from session
            subscription_tier: 'large', // Let's give them large (Full premium) by default so they can explore!
            updated_at: new Date().toISOString()
          };
          setCurrentUser(defaultSessionUser);
          setCurrentUserSession(defaultSessionUser);
        }
      })
      .catch(err => {
        console.error('Failed to sync master database:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Load initial states on mount
  useEffect(() => {
    // Check if coming back from positive Stripe checkout redirect
    const params = new URLSearchParams(window.location.search);
    const checkoutSuccess = params.get('checkout_success');
    const tier = params.get('tier') as 'small' | 'mid' | 'large' | null;

    if (checkoutSuccess === 'true' && tier) {
      const activeUser = getCurrentUser();
      if (activeUser) {
        setLoading(true);
        updateProfileTier(activeUser.email, tier)
          .then((updatedProfile) => {
            setCurrentUser(updatedProfile);
            setCurrentUserSession(updatedProfile);
            setAlertMessage(`Success! Your premium Swedish equity license is activated for level: ${
              tier === 'small' ? 'Basic (Small)' : tier === 'mid' ? 'Standard (Mid)' : 'Premium (Large)'
            }. Welcome aboard.`);
            window.history.replaceState({}, document.title, window.location.pathname);
            reloadAllData();
            setView('home');
          })
          .catch(err => {
            console.error('Failed to apply Stripe upgrade', err);
            setAlertMessage('Upgrade registered. Please refresh key metrics or relog if positions are locked.');
            setLoading(false);
          });
      } else {
        setAlertMessage('Purchase recognized. Log in with the same email to unlock active models.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (params.get('checkout_cancel') === 'true') {
      setView('billing');
      setAlertMessage('Payment checkout cancelled. No charges were made.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    reloadAllData();
  }, []);

  const handleAuthSuccess = (profile: Profile) => {
    setCurrentUser(profile);
    setCurrentUserSession(profile);
    setIsAuthOpen(false);
    reloadAllData();
    setView('home');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentUserSession(null);
    // Remove session
    localStorage.removeItem('current_user_session_v3');
    setView('home');
  };

  const handleSelectTier = (tierId: 'small' | 'mid' | 'large', price: number, name: string) => {
    if (!currentUser) {
      setIsAuthOpen(true);
    } else {
      setCheckoutTarget({ tierId, price, name });
    }
  };

  const handleCheckoutSuccess = (updatedTier: 'small' | 'mid' | 'large') => {
    if (!currentUser) return;

    updateProfileTier(currentUser.email, updatedTier)
      .then((updatedProfile) => {
        setCurrentUser(updatedProfile);
        setCurrentUserSession(updatedProfile);
        setCheckoutTarget(null);
        reloadAllData();
        setView('home');
      })
      .catch(err => {
        console.error('Checkout tier update failed', err);
        setAlertMessage('An error occurred while updating your subscription details.');
      });
  };

  const handleCancelCheckout = () => {
    setCheckoutTarget(null);
  };

  const handleResetData = () => {
    setResetModalOpen(true);
  };

  const executeResetData = () => {
    resetToDefault()
      .then(() => {
        reloadAllData();
        setResetModalOpen(false);
        setView('home');
        setAlertMessage('Database state reset safely to original demo coordinates.');
      })
      .catch(err => {
        console.error('Reset database failed', err);
        setAlertMessage('An error occurred while resetting the static databases.');
      });
  };

  const downloadDatabaseJson = () => {
    try {
      const db = getLocalDb();
      const jsonStr = JSON.stringify(db, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "db.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
    }
  };

  const togglePaywallSettings = async () => {
    try {
      await updateAppSettings(!paywallsEnabled);
      reloadAllData();
    } catch (err) {
      console.warn(err);
    }
  };

  const isAdmin = currentUser?.email.toLowerCase() === 'admin@modelportfolio.se';

  // Navigation choices (Scandinavian Business Professional Sidebar)
  const menuItems = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'contracts', label: 'Contracts', icon: Briefcase },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'billing', label: 'Invoices', icon: CreditCard },
    { id: 'transactions', label: 'Transactions', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex flex-col items-center justify-center font-sans antialiased text-stone-903 relative overflow-hidden">
        <div className="flex flex-col items-center justify-center gap-4 z-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-800" />
          <span className="text-[10px] font-bold text-stone-400 font-mono tracking-widest uppercase animate-pulse">Synchronizing portfolio parameters...</span>
        </div>
      </div>
    );
  }

  const currentPortfolio = portfolios.find(p => p.id === 'p1') || portfolios[0];
  const activeHoldings = holdings.filter(h => h.portfolio_id === currentPortfolio?.id);
  const activeTrades = trades.filter(t => t.portfolio_id === currentPortfolio?.id);
  const activeHistory = portfolioHistory.filter(ph => ph.portfolio_id === currentPortfolio?.id);

  return (
    <div className="min-h-screen bg-[#fbfbfa] flex flex-col font-sans select-none antialiased text-stone-900">
      
      {/* Top Header Navigation */}
      <Header
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        currentView={currentView}
        setView={setView}
        paywallsEnabled={paywallsEnabled}
      />

      <main className="flex-1">
        {currentView === 'landing' && (
          <LandingPage
            currentUser={currentUser}
            onSelectTier={handleSelectTier}
            onOpenAuth={() => setIsAuthOpen(true)}
            setView={setView}
            paywallsEnabled={paywallsEnabled}
          />
        )}

        {currentView === 'dashboard' && (
          <Dashboard
            portfolios={portfolios}
            portfolioHistory={portfolioHistory}
            holdings={holdings}
            trades={trades}
            currentUser={currentUser}
            onUpgrade={() => setView('landing')}
            onReset={handleResetData}
            paywallsEnabled={paywallsEnabled}
            onAddPositionClick={() => setView(isAdmin ? 'admin' : 'landing')}
          />
        )}

        {currentView === 'admin' && isAdmin && (
          <AdminPanel
            portfolios={portfolios}
            portfolioHistory={portfolioHistory}
            holdings={holdings}
            trades={trades}
            currentUser={currentUser}
            onRefresh={reloadAllData}
            onReset={handleResetData}
            setView={setView}
            paywallsEnabled={paywallsEnabled}
          />
        )}
      </main>

      {/* GLOBAL MODALS & UTILITY DIALOGS */}
      {isAuthOpen && (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {checkoutTarget && currentUser && (
        <StripeCheckout
          tierId={checkoutTarget.tierId}
          tierName={checkoutTarget.name}
          price={checkoutTarget.price}
          email={currentUser.email}
          onCancel={handleCancelCheckout}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Standard Alert Overlay */}
      {alertMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <div className="bg-white rounded max-w-sm w-full p-6 border border-stone-200 shadow-xl relative block text-center animate-fade-in">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-50 border border-stone-200 text-stone-600 mb-4 mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-stone-900">System Notification</h3>
            <p className="text-xs text-stone-500 mt-2 leading-relaxed">{alertMessage}</p>
            <div className="mt-6">
              <button
                onClick={() => setAlertMessage(null)}
                className="w-full rounded bg-stone-900 hover:bg-stone-800 text-white py-2.5 text-xs font-semibold transition cursor-pointer uppercase tracking-wider"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Reset Database Dialog */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <div className="bg-white rounded max-w-md w-full p-6 border border-stone-200 shadow-xl relative block text-left animate-fade-in">
            <h3 className="text-sm font-semibold text-stone-900 tracking-tight">Confirm Database Preset Reset?</h3>
            <p className="text-xs text-stone-500 mt-2.5 leading-relaxed font-serif italic">
              This action updates the server database file permanently. Any user adjustments, added portfolios, or live trades recorded will be deleted.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setResetModalOpen(false)}
                className="flex-1 rounded border border-stone-300 hover:bg-stone-50 text-stone-700 py-2.5 text-xs font-semibold transition cursor-pointer bg-white"
              >
                Cancel Action
              </button>
              <button
                onClick={executeResetData}
                className="flex-1 rounded bg-red-600 hover:bg-red-700 text-white py-2.5 text-xs font-semibold transition cursor-pointer"
              >
                Yes, Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
