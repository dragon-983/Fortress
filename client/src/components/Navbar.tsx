import React, { useState } from 'react';
import {
  Shield,
  Users,
  RotateCcw,
  Sliders,
  History,
  Wallet,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { UserSession } from '../lib/api.js';
import { formatAddress } from '../lib/stellar.js';

interface NavbarProps {
  currentTab: 'landing' | 'dashboard' | 'guardians' | 'recovery' | 'spending' | 'activity';
  setCurrentTab: (tab: 'landing' | 'dashboard' | 'guardians' | 'recovery' | 'spending' | 'activity') => void;
  session: UserSession | null;
  onOpenWalletModal: () => void;
  onSelectRole: (role: UserSession['role']) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  session,
  onOpenWalletModal,
  onSelectRole,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const roleConfigs: Record<
    UserSession['role'],
    { label: string; badgeColor: string; description: string }
  > = {
    owner: {
      label: 'Wallet Owner',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      description: 'Full administrative rights & asset transfers',
    },
    guardian_1: {
      label: 'Cold Vault (Guardian 1)',
      badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      description: 'Propose & approve social recovery',
    },
    guardian_2: {
      label: 'Family Key (Guardian 2)',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      description: 'Co-signs recovery proposals',
    },
    guardian_3: {
      label: 'Security Node (Guardian 3)',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      description: 'Institutional recovery node',
    },
    recovery_candidate: {
      label: 'Target New Owner',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description: 'Designated recipient of recovered wallet',
    },
    user: {
      label: 'Connected Wallet',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      description: 'Freighter wallet address',
    },
  };

  const currentRoleConfig = session?.role ? roleConfigs[session.role] : roleConfigs.owner;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => setCurrentTab('landing')}
            className="flex cursor-pointer items-center gap-3 group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  FORTRESS
                </span>
                <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-400 border border-sky-500/20">
                  SOROBAN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Programmable Security Wallet on Stellar
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-800">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Shield className="h-3.5 w-3.5 text-sky-400" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setCurrentTab('guardians')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'guardians'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              <span>Guardians</span>
            </button>

            <button
              onClick={() => setCurrentTab('recovery')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'recovery'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
              <span>Social Recovery</span>
            </button>

            <button
              onClick={() => setCurrentTab('spending')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'spending'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Sliders className="h-3.5 w-3.5 text-emerald-400" />
              <span>Spending Caps</span>
            </button>

            <button
              onClick={() => setCurrentTab('activity')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'activity'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <History className="h-3.5 w-3.5 text-purple-400" />
              <span>Security Trail</span>
            </button>
          </nav>
        </div>

        {/* Right Section: Testnet indicator, Persona switcher, Connect button */}
        <div className="flex items-center gap-3">
          {/* Testnet Badge */}
          <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-300 border border-slate-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Stellar Testnet</span>
          </div>

          {/* Quick Sandbox Persona Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${currentRoleConfig.badgeColor}`}
            >
              <span>{currentRoleConfig.label}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-md z-50">
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Select Sandbox Persona
                </div>
                {(
                  ['owner', 'guardian_1', 'guardian_2', 'guardian_3', 'recovery_candidate'] as Array<
                    UserSession['role']
                  >
                ).map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      onSelectRole(role);
                      setShowRoleMenu(false);
                      if (role === 'recovery_candidate' || role.startsWith('guardian')) {
                        setCurrentTab('recovery');
                      } else {
                        setCurrentTab('dashboard');
                      }
                    }}
                    className={`w-full flex flex-col items-start p-2 rounded-lg text-left text-xs transition-colors hover:bg-slate-800/80 ${
                      session?.role === role ? 'bg-slate-800 text-white' : 'text-slate-300'
                    }`}
                  >
                    <div className="font-medium flex items-center justify-between w-full">
                      <span>{roleConfigs[role].label}</span>
                      {session?.role === role && <CheckCircle className="h-3.5 w-3.5 text-sky-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400">{roleConfigs[role].description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Wallet Button */}
          <button
            onClick={onOpenWalletModal}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white border border-slate-800 transition-all shadow-sm"
          >
            <Wallet className="h-3.5 w-3.5 text-sky-400" />
            <span>{session?.wallet ? formatAddress(session.wallet) : 'Connect'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
