import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  RotateCcw,
  Sliders,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Lock,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  getWalletStatus,
  WalletStatus,
  UserSession,
  getSecurityEvents,
} from '../lib/api.js';
import { formatAddress, formatAmount } from '../lib/stellar.js';

interface DashboardViewProps {
  session: UserSession | null;
  onNavigateTab: (tab: 'guardians' | 'recovery' | 'spending' | 'activity') => void;
  onOpenWalletModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  session,
  onNavigateTab,
  onOpenWalletModal,
}) => {
  const [wallet, setWallet] = useState<WalletStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [walletRes, eventsRes] = await Promise.all([
        getWalletStatus(),
        getSecurityEvents({ limit: '5' }),
      ]);
      if (walletRes.success) setWallet(walletRes.wallet);
      if (eventsRes.success) setRecentEvents(eventsRes.events);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeProposal = wallet?.activeProposals?.[0];

  return (
    <div className="space-y-8 pb-16">
      {/* Active Recovery Threat / Alert Banner (if any) */}
      {activeProposal && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-300">
                Active Social Recovery Proposal #{activeProposal.on_chain_proposal_id} ({activeProposal.status})
              </div>
              <div className="text-xs text-amber-200/80 mt-0.5">
                Target: {formatAddress(activeProposal.proposed_owner)} • Approvals:{' '}
                {activeProposal.approvals?.length} of {wallet?.threshold} required
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('recovery')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-amber-950/40"
          >
            Review in Recovery Center →
          </button>
        </div>
      )}

      {/* Main Status Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-sky-950/40 p-6 md:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
              <span>Smart Account Enforced</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              FORTRESS Security Vault
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed font-mono">
              Smart Account: <span className="text-sky-400">{wallet?.contract_id || 'Loading...'}</span>
            </p>
            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-4">
              <span>Owner: <strong className="text-white font-mono">{formatAddress(wallet?.owner_address)}</strong></span>
              <span>•</span>
              <span>Network: <strong className="text-white capitalize">{wallet?.stellarNetwork || 'Testnet'}</strong></span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 text-sky-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh State</span>
            </button>
            <button
              onClick={() => onNavigateTab('spending')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-900/30"
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>Transfer Assets</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Balances */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Vault Liquidity</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            ${formatAmount(wallet?.balances?.usdc || 2500)}{' '}
            <span className="text-xs text-slate-400 font-normal">USDC</span>
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono">
            + {formatAmount(wallet?.balances?.xlm || 100)} Native XLM
          </div>
        </div>

        {/* Guardian Quorum */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Guardian Quorum</span>
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-400">
            {wallet?.threshold || 2} of {wallet?.guardian_count || 3}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            M-of-N threshold required
          </div>
        </div>

        {/* Daily Spending Limit */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Daily Spending Cap</span>
            <Sliders className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            ${formatAmount(wallet?.daily_limit || 1500)}{' '}
            <span className="text-xs text-slate-400 font-normal">USDC</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Max ${formatAmount(wallet?.per_tx_limit || 500)} per transaction
          </div>
        </div>

        {/* Recovery Timelock */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Recovery Timelock</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            {Math.floor(Number(wallet?.recovery_timelock || 3600) / 60)} min
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Mandatory veto delay
          </div>
        </div>
      </div>

      {/* Grid: Guardians Overview & Recent Security Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Guardians summary */}
        <div className="lg:col-span-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-400" />
              <span>Registered Guardians ({wallet?.guardians?.length || 0})</span>
            </h2>
            <button
              onClick={() => onNavigateTab('guardians')}
              className="text-xs text-sky-400 hover:underline"
            >
              Manage Guardians →
            </button>
          </div>

          <div className="space-y-2.5">
            {wallet?.guardians?.map((g) => (
              <div
                key={g.id}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-white">{g.alias_label}</div>
                  <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                    {formatAddress(g.guardian_address)}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Security Events */}
        <div className="lg:col-span-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-sky-400" />
              <span>Recent Security Events</span>
            </h2>
            <button
              onClick={() => onNavigateTab('activity')}
              className="text-xs text-sky-400 hover:underline"
            >
              Full Trail →
            </button>
          </div>

          <div className="space-y-2.5">
            {recentEvents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No events logged yet.</div>
            ) : (
              recentEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-200 capitalize">
                      {ev.event_type.replace('_', ' ')}
                    </span>
                    <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                      Actor: {formatAddress(ev.actor)}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(ev.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
