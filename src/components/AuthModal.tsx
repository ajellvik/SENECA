import React, { useState } from 'react';
import { X, Mail, Shield } from 'lucide-react';
import { signUpUser, loginUser } from '../data/mockData';
import { Profile } from '../types';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: Profile) => void;
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please provide a valid email address');
      return;
    }

    if (isLogin) {
      loginUser(email)
        .then((user) => {
          onSuccess(user);
          onClose();
        })
        .catch(() => {
          // If profile doesn't exist, auto signup with 'none' tier to make testing seamless
          signUpUser(email, 'none')
            .then((newProfile) => {
              onSuccess(newProfile);
              onClose();
            })
            .catch((regErr) => {
              setError(regErr.message || 'Could not execute client authentication query.');
            });
        });
    } else {
      signUpUser(email, 'none')
        .then((newProfile) => {
          onSuccess(newProfile);
          onClose();
        })
        .catch((regErr) => {
          setError(regErr.message || 'Account registration failed.');
        });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rg-green/45 backdrop-blur-sm animate-fade-in text-slate-900">
      <div 
        id="auth-modal" 
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white border-t-4 border-t-rg-orange border border-stone-200 shadow-xl p-8 relative"
      >
        <button 
          onClick={onClose}
          className="absolute right-5 top-5 text-stone-400 hover:text-rg-orange transition cursor-pointer"
          aria-label="Close"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rg-orange/20 bg-rg-clay-light text-rg-orange mb-4 shadow-xs">
            <span className="font-serif text-sm font-semibold text-rg-orange">S</span>
          </div>
          <h3 className="text-xl font-serif font-normal text-stone-900">
            {isLogin ? 'Investor Login' : 'Register Account'}
          </h3>
          <p className="text-xs text-stone-500 mt-2 font-serif italic">
            {isLogin ? 'Provide your credentials to retrieve access credentials' : 'Track our structured model portfolios and analytical deep-dives'}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-100 text-rose-805 text-xs py-2.5 px-3 rounded flex items-center gap-2 font-mono">
            <Shield className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 font-mono mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                <Mail className="h-4 w-4 text-stone-350" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="investor@example.com"
                className="w-full rounded border border-stone-250 bg-[#faf9f6] py-2.5 pl-9 pr-4 text-xs text-stone-900 placeholder-stone-400 focus:border-rg-orange focus:bg-white focus:outline-none focus:ring-1 focus:ring-rg-orange transition"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-rg-orange py-3 text-xs font-semibold tracking-wider uppercase text-white hover:bg-rg-clay transition shadow-md shadow-rg-orange/10 cursor-pointer active:translate-y-px"
          >
            {isLogin ? 'Access Account' : 'Complete Setup'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs text-stone-500 hover:text-rg-orange transition underline font-serif italic cursor-pointer"
          >
            {isLogin ? "Don't have an active license? Register here" : 'Already registered? Authenticate here'}
          </button>
        </div>

      </div>
    </div>
  );
}
