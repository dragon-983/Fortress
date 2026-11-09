import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  getProposals,
  getWalletStatus,
  proposeRecovery,
  approveProposal,
  cancelProposal,
  executeProposal,
  RecoveryProposal,
  UserSession,
} from '../lib/api.js';
import { formatAddress } from '../lib/stellar.js';

interface RecoveryCenterViewProps {
  session: UserSession | null;
  onOpenWalletModal: () => void;
}

export const RecoveryCenterView: React.FC<RecoveryCenterViewProps> = ({
  session,
  onOpenWalletModal,
}) => {
  const [proposals, setProposals] = useState<RecoveryProposal[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Proposal form state
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [targetNewOwner, setTargetNewOwner] = useState('GARECOVERY99999999999999999999999999999999999999999999999999');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, wRes] = await Promise.all([getProposals(), getWalletStatus()]);
      if (pRes.success) setProposals(pRes.proposals);
      if (wRes.success) setWallet(wRes.wallet);
    } catch (err) {
      console.error('Error loading recovery data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.wallet) return onOpenWalletModal();

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await proposeRecovery({ proposed_owner: targetNewOwner });
      if (res.success) {
        setSuccessMsg(`Recovery proposal #${res.proposal.on_chain_proposal_id} submitted!`);
        setShowProposeModal(false);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit recovery proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    if (!session?.wallet) return onOpenWalletModal();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await approveProposal(id);
      if (res.success) {
        setSuccessMsg(`Approval registered! Proposal status: ${res.proposal.status}`);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve proposal');
    }
  };

  const handleCancel = async (id: number) => {
    if (!session?.wallet) return onOpenWalletModal();
    if (!confirm('Are you sure you want to cancel this recovery proposal?')) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await cancelProposal(id);
      if (res.success) {
        setSuccessMsg(`Proposal #${res.proposal.on_chain_proposal_id} has been cancelled.`);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel proposal');
    }
  };

  const handleExecute = async (id: number) => {
    if (!session?.wallet) return onOpenWalletModal();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await executeProposal(id);
      if (res.success) {
        setSuccessMsg(`Recovery executed! New wallet owner: ${formatAddress(res.newOwner)}`);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to execute recovery');
    }
  };

  const isGuardian = wallet?.guardians?.some((g: any) => g.guardian_address === session?.wallet);
  const isOwner = session?.wallet === wallet?.owner_address;

  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/40 p-6 md:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
              <RotateCcw className="h-4 w-4" />
              <span>Decentralized Account Recovery</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Social Recovery Center
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              If the owner loses access or devices are destroyed, registered guardians coordinate to transfer control to a verified backup account. Timelock delays give the active owner a veto window to prevent rogue takeovers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3">
            <button
              onClick={() => {
                setShowProposeModal(true);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-950/40"
            >
              <Plus className="h-4 w-4" />
              <span>Initiate Recovery Proposal</span>
            </button>
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
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Proposals List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          <span>Recovery Proposals ({proposals.length})</span>
        </h2>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading recovery proposals...</div>
        ) : proposals.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 rounded-2xl border border-slate-800 bg-slate-900/40">
            No recovery proposals submitted yet. Wallet is secure and operating under primary owner authority.
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((p) => {
              const threshold = wallet?.threshold || 2;
              const approvalCount = p.approvals?.length || 0;
              const pct = Math.min(Math.round((approvalCount / threshold) * 100), 100);
              const hasApproved = p.approvals?.includes(session?.wallet || '');
              const timelockSecondsLeft = Math.max(0, Number(p.timelock_until) - now);
              const canExecute = p.status === 'Timelocked' && timelockSecondsLeft === 0;

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-6 transition-all backdrop-blur-sm space-y-4 ${
                    p.status === 'Timelocked'
                      ? 'border-amber-500/40 bg-slate-900/90 shadow-xl shadow-amber-950/20'
                      : p.status === 'Executed'
                      ? 'border-slate-800 bg-slate-950/40 opacity-70'
                      : 'border-slate-800 bg-slate-900/60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        Proposal #{p.on_chain_proposal_id}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          p.status === 'Timelocked'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                            : p.status === 'Executed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : p.status === 'Cancelled'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Created on: {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] text-slate-400">Proposed New Owner Account:</span>
                      <div className="font-mono text-white font-semibold break-all">
                        {p.proposed_owner}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] text-slate-400">Proposing Guardian:</span>
                      <div className="font-mono text-slate-300 break-all">
                        {p.proposer}
                      </div>
                    </div>
                  </div>

                  {/* Quorum Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">
                        Guardian Approvals: {approvalCount} of {threshold} Required
                      </span>
                      <span className="font-mono text-sky-400">{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-amber-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Timelock Countdown */}
                  {p.status === 'Timelocked' && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-amber-300">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>
                          {timelockSecondsLeft > 0
                            ? `Mandatory Timelock Delay: ${Math.floor(timelockSecondsLeft / 60)}m ${timelockSecondsLeft % 60}s remaining`
                            : 'Timelock elapsed! Eligible for immediate execution.'}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-400/80">Owner Veto Active</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    {/* Approve button (for guardians who haven't approved) */}
                    {(p.status === 'Pending' || p.status === 'Timelocked') && !hasApproved && (
                      <button
                        onClick={() => handleApprove(p.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors shadow-sm"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Recovery</span>
                      </button>
                    )}

                    {/* Cancel button (for Owner or Proposer) */}
                    {(p.status === 'Pending' || p.status === 'Timelocked') && (
                      <button
                        onClick={() => handleCancel(p.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/30 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Cancel Recovery</span>
                      </button>
                    )}

                    {/* Execute button */}
                    {p.status === 'Timelocked' && (
                      <button
                        onClick={() => handleExecute(p.id)}
                        disabled={!canExecute}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Execute Ownership Transfer</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Initiate Recovery Proposal */}
      {showProposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Initiate Social Recovery</h3>
              <button onClick={() => setShowProposeModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handlePropose} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Proposed New Owner Address</label>
                <input
                  type="text"
                  required
                  placeholder="G..."
                  value={targetNewOwner}
                  onChange={(e) => setTargetNewOwner(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Security Notice</span>
                </div>
                <p>
                  Submitting a proposal automatically records your approval. The required threshold ({wallet?.threshold} guardians) must be met before the {Math.floor(Number(wallet?.recovery_timelock || 3600) / 60)}-minute timelock begins.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-950/30"
              >
                {submitting ? 'Submitting to Soroban...' : 'Submit Recovery Proposal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

