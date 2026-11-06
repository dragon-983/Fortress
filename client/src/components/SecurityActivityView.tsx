import React, { useState, useEffect } from 'react';
import {
  History,
  Shield,
  Search,
  Filter,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { getSecurityEvents, getSecurityStats } from '../lib/api.js';
import { formatAddress } from '../lib/stellar.js';

export const SecurityActivityView: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, statsRes] = await Promise.all([
        getSecurityEvents({
          event_type: filterType || undefined,
          search: searchQuery || undefined,
        }),
        getSecurityStats(),
      ]);
      if (eventsRes.success) setEvents(eventsRes.events);
      if (statsRes.success) setStats(statsRes.stats);
    } catch (err) {
      console.error('Error loading security activity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'initialized':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">Initialized</span>;
      case 'guardian_added':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Guardian Added</span>;
      case 'guardian_removed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Guardian Removed</span>;
      case 'recovery_proposed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Recovery Proposed</span>;
      case 'recovery_approved':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Recovery Approved</span>;
      case 'recovery_timelocked':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">Timelock Active</span>;
      case 'recovery_cancelled':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">Recovery Cancelled</span>;
      case 'recovery_executed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Ownership Recovered</span>;
      case 'transfer_executed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Transfer Executed</span>;
      case 'transfer_rejected':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">Transfer Blocked</span>;
      case 'limits_updated':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Limits Updated</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">{type}</span>;
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/40 p-6 md:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400 border border-purple-500/20">
              <History className="h-4 w-4" />
              <span>Immutable Ledger History</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Security Event Audit Trail
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              Every sensitive action — guardian additions, social recovery proposals, threshold updates, and transfer policy evaluations — is cryptographically recorded.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 text-purple-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Events</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Total Events</span>
            <div className="text-xl font-bold text-white mt-1">{stats.totalEvents}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Blocked Breaches</span>
            <div className="text-xl font-bold text-rose-400 mt-1">{stats.rejectedTransfersCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Active Proposals</span>
            <div className="text-xl font-bold text-amber-400 mt-1">{stats.activeProposalsCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Completed Recoveries</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">{stats.completedRecoveriesCount}</div>
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 backdrop-blur-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="relative w-full sm:w-80">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search actor or tx hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </form>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
            {['', 'transfer_executed', 'transfer_rejected', 'recovery_proposed', 'guardian_added'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 rounded-xl text-[11px] font-medium transition-all ${
                  filterType === type
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {type === '' ? 'All Events' : type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto">
          {events.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No events found matching query.</div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getEventBadge(ev.event_type)}</div>
                  <div>
                    <div className="font-semibold text-slate-200">
                      Actor: <span className="font-mono text-white">{formatAddress(ev.actor)}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      Details: {JSON.stringify(ev.details)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  {ev.tx_hash && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${ev.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sky-400 hover:underline font-mono text-[11px]"
                    >
                      <span>tx:{ev.tx_hash.slice(0, 8)}</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  <div className="text-[10px] text-slate-500 font-mono">
                    {new Date(ev.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
