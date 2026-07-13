import React, { useState, useEffect } from 'react';
import { CreditCard, Shield, Lock, ArrowLeft, Loader2, ExternalLink, AlertCircle, HelpCircle } from 'lucide-react';
import { createStripeCheckoutSession } from '../data/mockData';

interface StripeCheckoutProps {
  tierId: 'small' | 'mid' | 'large';
  tierName: string;
  price: number;
  email: string;
  onCancel: () => void;
  onSuccess: (updatedTier: 'small' | 'mid' | 'large') => void;
}

export default function StripeCheckout({
  tierId,
  tierName,
  price,
  email,
  onCancel,
  onSuccess
}: StripeCheckoutProps) {
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<'none' | 'missing_keys' | 'network_error'>('none');
  const [rawErrorMessage, setRawErrorMessage] = useState<string | null>(null);

  // Dynamic Stripe Payment Links as fallback
  const getStaticPaymentLink = (): string | null => {
    const metaEnv = (import.meta as any).env;
    if (tierId === 'small') return metaEnv.VITE_STRIPE_LINK_SMALL || null;
    if (tierId === 'mid') return metaEnv.VITE_STRIPE_LINK_MID || null;
    if (tierId === 'large') return metaEnv.VITE_STRIPE_LINK_LARGE || null;
    return null;
  };

  const isValidUrl = (urlStr: string | null | undefined): boolean => {
    if (!urlStr) return false;
    try {
      const url = new URL(urlStr);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  const handleCheckoutInitiation = async () => {
    setLoading(true);
    setErrorStatus('none');
    setRawErrorMessage(null);

    try {
      const result = await createStripeCheckoutSession(tierId, email);
      
      if (result.url) {
        // Redirect directly to Stripe Hosted Checkout page!
        window.location.href = result.url;
        return;
      }

      // If server session creation fails, verify if client has static payment links defined
      const linkFallback = getStaticPaymentLink();
      if (linkFallback && isValidUrl(linkFallback) && linkFallback !== 'https://buy.stripe.com/test_smallTierLink' && !linkFallback.includes('buy.stripe.com/test_')) {
        // Appending pre-filled email to Stripe Checkout Link
        const urlObj = new URL(linkFallback);
        urlObj.searchParams.set('prefilled_email', email);
        window.location.href = urlObj.toString();
        return;
      }

      // If no endpoint session URL was produced AND no custom Payment Link is active, show instructions to administrator
      setErrorStatus('missing_keys');
      setRawErrorMessage(result.error || 'The server returned an empty result without a checkout URL.');
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to initiate live checkout:', err);
      // Fallback checkout link check
      const linkFallback = getStaticPaymentLink();
      if (linkFallback && isValidUrl(linkFallback)) {
        const urlObj = new URL(linkFallback);
        urlObj.searchParams.set('prefilled_email', email);
        window.location.href = urlObj.toString();
        return;
      }
      
      setErrorStatus('network_error');
      setRawErrorMessage(err.message || 'Could not communicate with the billing server.');
      setLoading(false);
    }
  };

  useEffect(() => {
    handleCheckoutInitiation();
  }, [tierId, email]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in text-slate-900">
      <div 
        id="stripe-checkout-modal" 
        className="w-full max-w-lg rounded bg-white border border-stone-250 shadow-2xl overflow-hidden min-h-[400px] flex flex-col justify-between"
      >
        {/* Top Header Card Info Section */}
        <div className="p-6 md:p-8 bg-white border-b border-stone-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-serif font-normal text-stone-900">License Activation</h3>
            <p className="text-[10px] text-stone-400 font-mono tracking-wider mt-1.5">LICENSE PLAN: <strong className="text-stone-800 uppercase">{tierName}</strong></p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-mono font-medium text-stone-900">{price.toLocaleString('sv-SE')}</span>
            <span className="text-[10px] text-stone-450 font-mono block mt-0.5">SEK / month</span>
          </div>
        </div>

        {/* Dynamic Center Workflows */}
        <div className="p-6 md:p-8 flex-1 flex flex-col items-center justify-center text-center">
          {loading ? (
            <div className="space-y-4 py-8 text-stone-900">
              <div className="flex justify-center">
                <Loader2 className="h-10 w-10 text-[#9a7352] animate-spin" />
              </div>
              <h4 className="font-serif font-normal text-sm text-stone-900 tracking-wide">Connecting with Stripe Payment Gateway...</h4>
              <p className="text-xs text-stone-450 max-w-xs mx-auto leading-relaxed">
                Establishing a fully-encrypted, secure session on Stripe servers for:<br/> <span className="font-semibold text-stone-800 font-mono">{email}</span>. You will be redirected shortly.
              </p>
              <div className="inline-flex items-center gap-1.5 rounded bg-stone-50 border border-stone-200 text-[9px] font-mono font-bold tracking-widest uppercase text-stone-600 px-3 py-1.5 mt-4">
                <Lock className="h-3 w-3 text-stone-450" />
                <span>Secure SSL Encryption</span>
              </div>
            </div>
          ) : errorStatus !== 'none' ? (
            <div className="py-2 text-stone-900 space-y-5 max-w-md mx-auto">
              <div className="flex h-11 w-11 items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-750 mx-auto">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h4 className="text-md font-serif font-normal text-stone-950">
                  {rawErrorMessage?.toLowerCase().includes('api key') || rawErrorMessage?.toLowerCase().includes('authentication')
                    ? 'Invalid Stripe API Key'
                    : 'System Awaiting Stripe Configuration'}
                </h4>
                <p className="text-xs text-stone-550 leading-relaxed font-serif">
                  {rawErrorMessage?.toLowerCase().includes('api key') || rawErrorMessage?.toLowerCase().includes('authentication')
                    ? 'The Stripe API reported that the Secret Key provided in process.env is invalid or expired.'
                    : 'This application is in developer sandbox mode. To connect real Stripe accounts, populate Stripe credentials in the settings panel.'}
                </p>
              </div>

              {rawErrorMessage && (
                <div className="text-left bg-stone-55 border border-stone-200 rounded p-4 mt-2">
                  <span className="block text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 font-mono">Gateway String Response:</span>
                  <p className="text-[10px] font-mono text-stone-500 leading-normal select-text break-words">
                    {rawErrorMessage}
                  </p>
                </div>
              )}

              {rawErrorMessage?.toLowerCase().includes('api key') || rawErrorMessage?.toLowerCase().includes('authentication') ? (
                <div className="p-4 bg-stone-50 rounded text-left border border-stone-200 space-y-2">
                  <span className="text-[10px] font-bold tracking-wider text-stone-850 block uppercase font-mono">⚠️ Action Steps for Developer</span>
                  <ul className="text-xs text-stone-500 space-y-1.5 list-disc pl-4 leading-relaxed font-serif">
                    <li>
                      <strong>Check Secret Value:</strong> Ensure the copied string does not contain stars <code className="font-mono bg-white px-1">•••••</code>. Obtain your active test secret key from your Stripe account.
                    </li>
                    <li>
                      <strong>Confirm Prices:</strong> Ensure price keys (e.g. <code className="font-mono bg-white px-1">price_...</code>) are configured to match target environments in the server file.
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="p-y bg-[#faf6f0] rounded text-left border border-stone-200 p-4 space-y-2">
                  <span className="text-[10px] font-bold tracking-wider text-[#9a7352] block uppercase font-mono">Simulate Sandbox Completion</span>
                  <ul className="text-xs text-stone-600 space-y-1.5 list-disc pl-4 leading-relaxed font-serif">
                    <li>
                      In our demo sandbox environment, you can bypass payments instantly using custom mock indicators or set up valid private credentials.
                    </li>
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  onClick={onCancel}
                  className="flex-1 rounded border border-stone-200 text-stone-700 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-stone-50 transition bg-white cursor-pointer"
                >
                  Cancel &amp; Close
                </button>
                <button
                  onClick={handleCheckoutInitiation}
                  className="flex-1 rounded bg-stone-900 text-white font-semibold py-2.5 text-xs uppercase tracking-wider hover:bg-stone-800 transition cursor-pointer"
                >
                  Retry Session
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Safe Foot Band */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-center gap-1.5 text-[10px] text-stone-400 font-mono">
          <Shield className="h-3.5 w-3.5 text-stone-400" />
          <span>Secure transaction proxy. Handled entirely by Stripe Inc.</span>
        </div>
      </div>
    </div>
  );
}
