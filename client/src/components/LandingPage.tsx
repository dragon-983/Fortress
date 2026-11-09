import React from 'react';
import {
  Shield,
  Users,
  RotateCcw,
  Sliders,
  History,
  Lock,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';

interface LandingPageProps {
  onEnterDashboard: () => void;
  onOpenWalletModal: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterDashboard,
  onOpenWalletModal,
}) => {
  return (
    <div className="space-y-16 pb-20 pt-4">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/95 to-sky-950/40 p-8 md:p-16 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400 border border-sky-500/20">
            <Sparkles className="h-4 w-4" />
            <span>Stellar & Soroban Smart Account Infrastructure</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
            Your Wallet.{' '}
            <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
              Your Rules.
            </span>{' '}
            Your Protection.
          </h1>

          <p className="text-base md:text-lg text-slate-300 leading-relaxed max-w-2xl">
            Conventional blockchain wallets rely on a single private key: lose it, and your funds are gone; leak it, and you're drained. **FORTRESS** transforms your Stellar account into a self-enforcing smart vault with social recovery, guardian quorums, time delays, and strict spending limits.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onEnterDashboard}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold transition-all shadow-lg shadow-sky-900/30 group"
            >
              <span>Launch FORTRESS Vault</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={onOpenWalletModal}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-semibold border border-slate-800 transition-colors"
            >
              <KeyRound className="h-4 w-4 text-sky-400" />
              <span>Connect Freighter / Sandbox</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>0% Centralized Custody</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>On-Chain Soroban Rules</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Native XLM & USDC</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Institutional-Grade Programmable Security
          </h2>
          <p className="text-xs text-slate-400">
            Every security invariant is verified by the Soroban smart contract, never by a centralized server.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Guardian Quorum</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Designate trusted guardians — hardware keys, family members, or institutional security nodes. Require an M-of-N threshold for critical account actions.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <RotateCcw className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Social Recovery with Timelock</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Lost your device? Your guardians approve recovery to a new address. A mandatory time delay allows the active owner to abort suspicious takeover attempts.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sliders className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">On-Chain Spending Limits</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enforce strict per-transaction and 24-hour daily limits. Even if a hot key is compromised, an attacker cannot drain your vault in one sweep.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <History className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Immutable Event Trail</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every configuration change, proposal submission, approval, and transfer emits strongly typed Soroban events verified on the Stellar ledger.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

