import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { LandingPage } from './components/LandingPage.js';
import { DashboardView } from './components/DashboardView.js';
import { GuardianManagementView } from './components/GuardianManagementView.js';
import { RecoveryCenterView } from './components/RecoveryCenterView.js';
import { SpendingControlsView } from './components/SpendingControlsView.js';
import { SecurityActivityView } from './components/SecurityActivityView.js';
import { WalletModal } from './components/WalletModal.js';
import { UserSession, getSession, setSession, getHealth } from './lib/api.js';
import { Shield, ExternalLink } from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<
    'landing' | 'dashboard' | 'guardians' | 'recovery' | 'spending' | 'activity'
  >('landing');
  const [session, setCurrentUserSession] = useState<UserSession | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [healthInfo, setHealthInfo] = useState<any>(null);

  useEffect(() => {
    const existing = getSession();
    setCurrentUserSession(existing);

    getHealth()
      .then((res) => setHealthInfo(res))
      .catch(() => {});
  }, []);

  const handleSelectSession = (newSession: UserSession) => {
    setCurrentUserSession(newSession);
    setSession(newSession);
  };

  const handleDisconnect = () => {
    setCurrentUserSession(null);
    setSession(null);
  };

  const handleSelectRole = (role: UserSession['role']) => {
    const addresses: Record<string, string> = {
      owner: 'GAOWNER111111111111111111111111111111111111111111111111111',
      guardian_1: 'GAGUARDIAN11111111111111111111111111111111111111111111111111',
      guardian_2: 'GAGUARDIAN22222222222222222222222222222222222222222222222222',
      guardian_3: 'GAGUARDIAN33333333333333333333333333333333333333333333333333',
      recovery_candidate: 'GARECOVERY99999999999999999999999999999999999999999999999999',
    };

    const newSession: UserSession = {
      wallet: addresses[role] || 'GAUSER111111111111111111111111111111111111111111111111111',
      role,
      name: `${role.toUpperCase()} Persona`,
    };
    handleSelectSession(newSession);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-slate-950">
      <div>
        <Navbar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          session={session}
          onOpenWalletModal={() => setWalletModalOpen(true)}
          onSelectRole={handleSelectRole}
        />

        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
          {currentTab === 'landing' && (
            <LandingPage
              onEnterDashboard={() => setCurrentTab('dashboard')}
              onOpenWalletModal={() => setWalletModalOpen(true)}
            />
          )}

          {currentTab === 'dashboard' && (
            <DashboardView
              session={session}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onOpenWalletModal={() => setWalletModalOpen(true)}
            />
          )}

          {currentTab === 'guardians' && (
            <GuardianManagementView
              session={session}
              onOpenWalletModal={() => setWalletModalOpen(true)}
            />
          )}

          {currentTab === 'recovery' && (
            <RecoveryCenterView
              session={session}
              onOpenWalletModal={() => setWalletModalOpen(true)}
            />
          )}

          {currentTab === 'spending' && (
            <SpendingControlsView
              session={session}
              onOpenWalletModal={() => setWalletModalOpen(true)}
            />
          )}

          {currentTab === 'activity' && <SecurityActivityView />}
        </main>
      </div>

      {/* Global Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 mt-12">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-sky-400" />
            <span className="font-semibold text-slate-300">FORTRESS</span>
            <span>— Programmable Security Wallet on Stellar</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] text-slate-400">
              Contract:{' '}
              {healthInfo?.stellar?.contractId
                ? healthInfo.stellar.contractId.slice(0, 10) + '...'
                : 'Soroban Testnet'}
            </span>
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline flex items-center gap-1"
            >
              <span>Stellar.org</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>

      {/* Wallet / Sandbox Modal */}
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        session={session}
        onSelectSession={handleSelectSession}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}
export default App;

