import React from 'react';
import { LogOut } from 'lucide-react';
import { Profile } from '../types';

interface HeaderProps {
  currentUser: Profile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  currentView: string;
  setView: (view: string) => void;
  paywallsEnabled: boolean;
}

export default function Header({ currentUser, onOpenAuth, onLogout, currentView, setView, paywallsEnabled }: HeaderProps) {
  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'large':
        return (
          <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest font-mono">
            Partner Edition
          </span>
        );
      case 'mid':
        return (
          <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest font-mono">
            Standard Edition
          </span>
        );
      case 'small':
        return (
          <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest font-mono">
            Basic Edition
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest font-mono">
            Free Access
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-45 w-full border-t-2 border-t-rg-orange border-b border-stone-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Scandinavian Wealth Branding - Ultra Clean Geometric */}
        <div 
          onClick={() => setView('landing')} 
          className="flex cursor-pointer items-center gap-2 hover:opacity-85 transition select-none"
        >
          <span className="font-sans text-xs sm:text-sm font-black tracking-[0.22em] text-stone-900 uppercase">
            Seneca Capital
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-rg-orange animate-pulse" />
        </div>

        {/* Quietly Elegant Navigation - High Contrast Minimalist */}
        <nav className="hidden md:flex items-center gap-8 font-sans">
          <button
            onClick={() => setView('landing')}
            className={`text-[10px] font-bold uppercase tracking-widest transition duration-150 cursor-pointer ${
              currentView === 'landing' 
                ? 'text-rg-orange' 
                : 'text-stone-400 hover:text-rg-orange'
            }`}
          >
            {paywallsEnabled ? 'Pricing' : 'Home'}
          </button>
          
          {(!paywallsEnabled || (currentUser && currentUser.subscription_tier !== 'none')) && (
            <button
              onClick={() => setView('dashboard')}
              className={`text-[10px] font-bold uppercase tracking-widest transition duration-150 cursor-pointer ${
                currentView === 'dashboard' 
                  ? 'text-rg-orange' 
                  : 'text-stone-400 hover:text-rg-orange'
              }`}
            >
              Dashboard
            </button>
          )}

          {currentUser && currentUser.email.toLowerCase() === 'admin@modelportfolio.se' && (
            <button
              onClick={() => setView('admin')}
              className={`text-[10px] font-bold uppercase tracking-widest transition duration-150 cursor-pointer ${
                currentView === 'admin' 
                  ? 'text-rg-orange' 
                  : 'text-stone-400 hover:text-rg-orange'
              }`}
            >
              Admin Panel
            </button>
          )}
        </nav>

        {/* User Session Controller */}
        <div className="flex items-center gap-4">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {currentUser.email.toLowerCase() === 'admin@modelportfolio.se' && (
                <button
                  onClick={() => setView('admin')}
                  className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition cursor-pointer font-mono ${
                    currentView === 'admin'
                      ? 'bg-rg-orange text-white border-rg-orange'
                      : 'bg-white text-stone-605 border-stone-200 hover:bg-stone-50 hover:text-rg-orange'
                  }`}
                >
                  Admin
                </button>
              )}
              
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-[10px] font-bold text-stone-800 font-mono">
                  {currentUser.email}
                </span>
                <span className="mt-0.5">
                  {paywallsEnabled ? getTierBadge(currentUser.subscription_tier) : (
                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest font-mono">
                      Full Access
                    </span>
                  )}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 hover:bg-stone-50 hover:text-rg-orange shadow-xs transition cursor-pointer"
                title="Log Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="inline-flex items-center rounded-full border border-rg-orange px-5.5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-rg-orange bg-white hover:bg-rg-orange hover:text-white transition duration-150 cursor-pointer active:translate-y-px"
            >
              Client Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
