import React, { useState, useEffect } from 'react';
import {
  Sliders,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import {
  getWalletStatus,
  transferFunds,
  updateSpendingLimits,
  updateTimelock,
  WalletStatus,
  UserSession,
} from '../lib/api.js';
import { formatAmount } from '../lib/stellar.js';

interface SpendingControlsViewProps {
  session: UserSession | null;
  onOpenWalletModal: () => void;
}

export const SpendingControlsView: React.FC<SpendingControlsViewProps> = ({
  session,
  onOpenWalletModal,
}) => {
  const [wallet, setWallet] = useState<WalletStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Transfer form
  const [transferTo, setTransferTo] = useState('GARECIPIENT99999999999999999999999999999999999999999999999');
  const [transferAmount, setTransferAmount] = useState<number>(100);
  const [transferring, setTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState<any>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Limits form
  const [perTxInput, setPerTxInput] = useState<number>(500);
  const [dailyInput, setDailyInput] = useState<number>(1500);
  const [timelockInput, setTimelockInput] = useState<number>(3600);
  const [savingLimits, setSavingLimits] = useState(false);
  const [limitsSuccess, setLimitsSuccess] = useState<string | null>(null);
  const [limitsError, setLimitsError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getWalletStatus();
      if (res.success) {
        setWallet(res.wallet);
        setPerTxInput(Number(res.wallet.per_tx_limit));
        setDailyInput(Number(res.wallet.daily_limit));
        setTimelockInput(Number(res.wallet.recovery_timelock));
      }
    } catch (err) {
      console.error('Error fetching wallet status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.wallet) return onOpenWalletModal();

    setTransferring(true);
    setTransferError(null);
    setTransferSuccess(null);

    try {
      const res = await transferFunds({
        to: transferTo,
        amount: transferAmount,
      });

      if (res.success) {
        setTransferSuccess(res);
        loadData();
      }
    } catch (err: any) {
      setTransferError(err.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const handleUpdateLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.wallet) return onOpenWalletModal();

    setSavingLimits(true);
    setLimitsError(null);
    setLimitsSuccess(null);

    try {
      const res = await updateSpendingLimits({
        per_tx_limit: perTxInput,
        daily_limit: dailyInput,
      });

      if (res.success) {
        setLimitsSuccess('Spending limits updated on-chain successfully!');
        loadData();
      }
    } catch (err: any) {
      setLimitsError(err.message || 'Failed to update spending limits');
    } finally {
      setSavingLimits(false);
    }
  };

  const handleUpdateTimelock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.wallet) return onOpenWalletModal();

    setSavingLimits(true);
    setLimitsError(null);
    setLimitsSuccess(null);

    try {
      const res = await updateTimelock({
        recovery_timelock: timelockInput,
      });

      if (res.success) {
        setLimitsSuccess(`Recovery timelock updated to ${Math.floor(timelockInput / 60)} minutes.`);
        loadData();
      }
    } catch (err: any) {
      setLimitsError(err.message || 'Failed to update timelock');
    } finally {
      setSavingLimits(false);
    }
  };

  const isOwner = session?.wallet === wallet?.owner_address;

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 p-6 md:p-10 shadow-2xl">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <Sliders className="h-4 w-4" />
            <span>On-Chain Rate Limiting & Vault Controls</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Spending Restrictions & Liquidity Controls
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            Configure transaction limits enforced directly by the Soroban smart contract. Even if an attacker steals your active signing key, on-chain rate limits prevent draining your assets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Transfer Asset Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 backdrop-blur-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-sky-400" />
                <span>Execute Vault Asset Transfer</span>
              </h2>
              <span className="text-xs text-slate-400">
                Available: ${formatAmount(wallet?.balances?.usdc || 2500)} USDC
              </span>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Recipient Stellar Address</label>
                <input
                  type="text"
                  required
                  placeholder="G..."
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Amount (USDC)</label>
                <div className="relative mt-1">
                  <DollarSign className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(Number(e.target.value))}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-bold"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                  <span>Test limit triggers:</span>
                  <button
                    type="button"
                    onClick={() => setTransferAmount(150)}
                    className="text-emerald-400 hover:underline"
                  >
                    $150 (Within Limits)
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setTransferAmount(600)}
                    className="text-rose-400 hover:underline"
                  >
                    $600 (Exceeds Per-Tx Limit)
                  </button>
                </div>
              </div>

              {transferError && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-400">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Transfer Blocked by On-Chain Policy</span>
                  </div>
                  <p>{transferError}</p>
                </div>
              )}

              {transferSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Transfer Successfully Disbursed!</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 space-y-0.5">
                    <div>Amount: ${formatAmount(transferSuccess.amount)} USDC</div>
                    <div className="truncate">Tx: {transferSuccess.txHash}</div>
                    <div>Remaining Daily Allowance: ${formatAmount(transferSuccess.remainingDailyAllowance)} USDC</div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={transferring}
                className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-sky-900/30 flex items-center justify-center gap-2"
              >
                {transferring ? (
                  <span>Evaluating Smart Account Policy...</span>
                ) : (
                  <>
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Send ${formatAmount(transferAmount)} USDC</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Update Limits & Timelock */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 backdrop-blur-sm space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="h-5 w-5 text-emerald-400" />
              <span>Configure Spending Parameters</span>
            </h2>

            {limitsSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                {limitsSuccess}
              </div>
            )}

            {limitsError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {limitsError}
              </div>
            )}

            <form onSubmit={handleUpdateLimits} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">
                  Per-Transaction Limit (USDC)
                </label>
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={perTxInput}
                  onChange={(e) => setPerTxInput(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">
                  24-Hour Daily Limit (USDC)
                </label>
                <input
                  type="number"
                  min="10"
                  step="50"
                  value={dailyInput}
                  onChange={(e) => setDailyInput(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={savingLimits || !isOwner}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/30"
              >
                {savingLimits ? 'Saving...' : 'Update Spending Limits'}
              </button>
            </form>

            <form onSubmit={handleUpdateTimelock} className="pt-4 border-t border-slate-800 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Recovery Timelock Delay</span>
                  <span className="text-[10px] text-slate-400">{Math.floor(timelockInput / 60)} minutes</span>
                </label>
                <input
                  type="number"
                  min="60"
                  step="60"
                  value={timelockInput}
                  onChange={(e) => setTimelockInput(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={savingLimits || !isOwner}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold transition-all"
              >
                Update Recovery Timelock
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
