import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Shield,
  KeyRound,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Users,
  RotateCcw,
} from 'lucide-react';
import { connectFreighter, checkFreighterStatus, formatAddress, formatAmount } from '../lib/stellar.js';
import { UserSession, getWalletBalances, getDemoProfiles } from '../lib/api.js';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession | null;
  onSelectSession: (session: UserSession) => void;
  onDisconnect: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  session,
  onSelectSession,
  onDisconnect,
}) => {
  const [freighterInstalled, setFreighterInstalled] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ xlm: string; usdc: string } | null>(null);
  const [demoProfiles, setDemoProfiles] = useState<Record<string, UserSession>>({});

  useEffect(() => {
    if (isOpen) {
      checkFreighter();
      loadProfiles();
      if (session?.wallet) {
        loadBalances(session.wallet);
      }
    }
  }, [isOpen, session?.wallet]);

  const checkFreighter = async () => {
    const status = await checkFreighterStatus();
    setFreighterInstalled(status.installed);
  };

  const loadProfiles = async () => {
    try {
      const res = await getDemoProfiles();
      if (res.success) {
        setDemoProfiles(res.profiles);
      }
    } catch {
      // ignore
    }
  };

  const loadBalances = async (wallet: string) => {
    try {
      const res = await getWalletBalances(wallet);
      if (res.success) {
        setBalances(res.balances);
      }
    } catch {
      // ignore
    }
  };

  const handleConnectFreighter = async () => {
    setConnecting(true);
    setErrorMsg(null);
    try {
      const address = await connectFreighter();
      if (address) {
        const newSession: UserSession = {
          wallet: address,
          role: 'user',
          name: `Freighter (${formatAddress(address)})`,
        };
        onSelectSession(newSession);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect Freighter wallet');
    } finally {
      setConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-sky-400" />
            <h3 className="font-bold text-white text-base">Connect Stellar Identity</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {/* Current Active Session */}
        {session ? (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-white">Active Session</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {session.role}
              </span>
            </div>

            <div className="font-mono text-xs text-slate-300 break-all bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              {session.wallet}
            </div>

            {balances && (
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2 rounded-xl bg-slate-900/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400">Vault USDC:</span>
                  <div className="font-bold text-white">${formatAmount(balances.usdc)}</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400">Native XLM:</span>
                  <div className="font-bold text-emerald-400">{formatAmount(balances.xlm)} XLM</div>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                onDisconnect();
                onClose();
              }}
              className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-colors"
            >
              Disconnect Session
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Freighter Wallet */}
            <div className="space-y-2">
              <button
                onClick={handleConnectFreighter}
                disabled={connecting}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 hover:from-slate-900 hover:to-slate-800 border border-slate-800 text-left transition-all shadow-md group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-white">Freighter Wallet</div>
                    <div className="text-[11px] text-slate-400">
                      {freighterInstalled ? 'Extension detected' : 'Official Stellar browser extension'}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-sky-400 group-hover:translate-x-0.5 transition-transform">
                  Connect →
                </span>
              </button>

              {!freighterInstalled && (
                <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                  <span>Need Freighter?</span>
                  <a
                    href="https://www.freighter.app"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <span>Install freighter.app</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* 1-Click Instant Sandbox Roles */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              <span>Instant Testnet Sandbox Personas</span>
            </span>
            <span className="text-[10px] text-slate-500">1-click switch</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {[
              { role: 'owner', title: 'Wallet Owner', desc: 'Transfer assets & configure rules', icon: Shield, color: 'text-emerald-400' },
              { role: 'guardian_1', title: 'Cold Vault (Guardian 1)', desc: 'Propose & sign recovery', icon: Users, color: 'text-sky-400' },
              { role: 'guardian_2', title: 'Family Key (Guardian 2)', desc: 'Co-signs recovery quorum', icon: Users, color: 'text-cyan-400' },
              { role: 'guardian_3', title: 'Security Node (Guardian 3)', desc: 'Institutional guardian node', icon: Users, color: 'text-indigo-400' },
              { role: 'recovery_candidate', title: 'Target Recovery Account', desc: 'New owner candidate', icon: RotateCcw, color: 'text-amber-400' },
            ].map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.role}
                  onClick={() => {
                    const prof = demoProfiles[r.role] || {
                      wallet: `GA${r.role.toUpperCase()}11111111111111111111111111111111111111111111111`,
                      role: r.role as any,
                      name: r.title,
                    };
                    onSelectSession(prof);
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${r.color}`} />
                    <div>
                      <div className="font-semibold text-xs text-slate-200">{r.title}</div>
                      <div className="text-[10px] text-slate-500">{r.desc}</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Select →</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

