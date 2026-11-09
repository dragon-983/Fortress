import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  getGuardians,
  addGuardian,
  removeGuardian,
  setThreshold,
  getWalletStatus,
  UserSession,
} from '../lib/api.js';
import { formatAddress } from '../lib/stellar.js';

interface GuardianManagementViewProps {
  session: UserSession | null;
  onOpenWalletModal: () => void;
}

export const GuardianManagementView: React.FC<GuardianManagementViewProps> = ({
  session,
  onOpenWalletModal,
}) => {
  const [guardians, setGuardians] = useState<any[]>([]);
  const [threshold, setThresholdState] = useState<number>(2);
  const [ownerAddress, setOwnerAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Modal / Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGuardianAddr, setNewGuardianAddr] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [newThresholdInput, setNewThresholdInput] = useState<number | ''>('');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [gRes, wRes] = await Promise.all([getGuardians(), getWalletStatus()]);
      if (gRes.success) setGuardians(gRes.guardians.filter((g: any) => g.is_active));
      if (wRes.success) {
        setThresholdState(wRes.wallet.threshold);
        setOwnerAddress(wRes.wallet.owner_address);
      }
    } catch (err) {
      console.error('Error loading guardians:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.wallet) return onOpenWalletModal();

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await addGuardian({
        guardian_address: newGuardianAddr,
        alias_label: newAlias || 'Guardian Key',
        new_threshold: newThresholdInput ? Number(newThresholdInput) : undefined,
      });

      if (res.success) {
        setSuccessMsg(`Guardian ${formatAddress(newGuardianAddr)} added successfully!`);
        setShowAddModal(false);
        setNewGuardianAddr('');
        setNewAlias('');
        setNewThresholdInput('');
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add guardian');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveGuardian = async (addr: string) => {
    if (!session?.wallet) return onOpenWalletModal();
    if (!confirm(`Are you sure you want to remove guardian ${formatAddress(addr)}?`)) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await removeGuardian(addr);
      if (res.success) {
        setSuccessMsg(`Guardian ${formatAddress(addr)} removed.`);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove guardian');
    }
  };

  const handleUpdateThreshold = async (newT: number) => {
    if (!session?.wallet) return onOpenWalletModal();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await setThreshold(newT);
      if (res.success) {
        setSuccessMsg(`Quorum threshold updated to ${res.threshold} of ${guardians.length}.`);
        setThresholdState(res.threshold);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update threshold');
    }
  };

  const isOwner = session?.wallet === ownerAddress;

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 p-6 md:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              <Users className="h-4 w-4" />
              <span>Multi-Signature Trust Network</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Guardian Quorum Management
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              Guardians protect your wallet against catastrophic key loss. When social recovery is initiated, a minimum of <strong className="text-indigo-400">{threshold} of {guardians.length} guardians</strong> must cryptographically sign before the timelock begins.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3">
            <button
              onClick={() => {
                setShowAddModal(true);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-900/30"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Guardian</span>
            </button>

            {!isOwner && (
              <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl text-center">
                Viewing as Sandbox: Switch to <strong>Wallet Owner</strong> to modify guardians
              </div>
            )}
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Quorum Threshold Configuration */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-400" />
              <span>Approval Quorum Threshold</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Number of distinct guardian signatures required to approve social recovery
            </p>
          </div>
          <span className="text-sm font-bold text-indigo-400 font-mono">
            Current: {threshold} of {guardians.length} ({Math.round((threshold / (guardians.length || 1)) * 100)}%)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          {Array.from({ length: guardians.length }, (_, i) => i + 1).map((t) => (
            <button
              key={t}
              onClick={() => handleUpdateThreshold(t)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                threshold === t
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-900/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {t} of {guardians.length} Required
            </button>
          ))}
        </div>
      </div>

      {/* Guardians List Grid */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Active Guardian Keys ({guardians.length})</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guardians.map((g, index) => (
            <div
              key={g.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-lg"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Guardian #{index + 1}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle className="h-3 w-3" />
                    <span>Authorized</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">{g.alias_label}</h3>
                  <div className="font-mono text-xs text-slate-400 break-all bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 mt-2">
                    {g.guardian_address}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500">
                  Enrolled on: {new Date(g.added_at).toLocaleDateString()}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => handleRemoveGuardian(g.guardian_address)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove Guardian</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add Guardian */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Add New Guardian Key</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddGuardian} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Guardian Stellar Public Key</label>
                <input
                  type="text"
                  required
                  placeholder="G..."
                  value={newGuardianAddr}
                  onChange={(e) => setNewGuardianAddr(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Label / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Ledger Cold Storage Nano X"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">New Quorum Threshold (Optional)</label>
                <input
                  type="number"
                  min="1"
                  max={guardians.length + 1}
                  placeholder={`Default keeps current threshold (${threshold})`}
                  value={newThresholdInput}
                  onChange={(e) => setNewThresholdInput(e.target.value ? Number(e.target.value) : '')}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-indigo-900/30"
              >
                {submitting ? 'Registering on Soroban...' : 'Confirm Guardian Registration'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

