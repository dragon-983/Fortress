export interface UserSession {
  wallet: string;
  role: 'owner' | 'guardian_1' | 'guardian_2' | 'guardian_3' | 'recovery_candidate' | 'user';
  name?: string;
}

let currentSession: UserSession | null = {
  wallet: 'GAOWNER111111111111111111111111111111111111111111111111111',
  role: 'owner',
  name: 'Primary Wallet Owner',
};

export function setSession(session: UserSession | null) {
  currentSession = session;
  if (session) {
    localStorage.setItem('fortress_session', JSON.stringify(session));
  } else {
    localStorage.removeItem('fortress_session');
  }
}

export function getSession(): UserSession | null {
  if (currentSession) return currentSession;
  try {
    const saved = localStorage.getItem('fortress_session');
    if (saved) {
      currentSession = JSON.parse(saved);
      return currentSession;
    }
  } catch {
    // ignore
  }
  return null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');
  if (session?.wallet) {
    headers.set('x-wallet-address', session.wallet);
    headers.set('x-user-role', session.role);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }
  return data;
}

// System & Auth
export async function getHealth() {
  return request<any>('/api/health');
}

export async function getDemoProfiles() {
  return request<{ success: boolean; profiles: Record<string, UserSession> }>(
    '/api/auth/demo-profiles'
  );
}

export async function getWalletBalances(wallet: string) {
  return request<{ success: boolean; wallet: string; balances: { xlm: string; usdc: string } }>(
    `/api/auth/balances?wallet=${encodeURIComponent(wallet)}`
  );
}

// Wallet Status & Asset Operations
export interface WalletStatus {
  contract_id: string;
  owner_address: string;
  threshold: number;
  guardian_count: number;
  per_tx_limit: string;
  daily_limit: string;
  recovery_timelock: string;
  guardians: Array<{
    id: number;
    guardian_address: string;
    alias_label: string;
    is_active: boolean;
  }>;
  activeProposals: any[];
  balances: { xlm: string; usdc: string };
  stellarNetwork: string;
  contractId: string;
}

export async function getWalletStatus() {
  return request<{ success: boolean; wallet: WalletStatus }>('/api/wallet');
}

export async function transferFunds(data: { to: string; amount: number; token_address?: string }) {
  return request<{
    success: boolean;
    txHash: string;
    recipient: string;
    amount: number;
    remainingDailyAllowance: number;
  }>('/api/wallet/transfer', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSpendingLimits(data: { per_tx_limit: number; daily_limit: number }) {
  return request<{ success: boolean; wallet: any }>('/api/wallet/limits', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTimelock(data: { recovery_timelock: number }) {
  return request<{ success: boolean; wallet: any }>('/api/wallet/timelock', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Guardians
export async function getGuardians() {
  return request<{ success: boolean; guardians: any[] }>('/api/guardians');
}

export async function addGuardian(data: {
  guardian_address: string;
  alias_label?: string;
  new_threshold?: number;
}) {
  return request<{ success: boolean; guardian: any; threshold: number }>('/api/guardians', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeGuardian(guardianAddress: string) {
  return request<{ success: boolean; removedGuardian: string; remainingCount: number; threshold: number }>(
    `/api/guardians/${guardianAddress}`,
    {
      method: 'DELETE',
    }
  );
}

export async function setThreshold(threshold: number) {
  return request<{ success: boolean; threshold: number }>('/api/guardians/threshold', {
    method: 'POST',
    body: JSON.stringify({ threshold }),
  });
}

// Recovery
export interface RecoveryProposal {
  id: number;
  on_chain_proposal_id: number;
  wallet_contract_id: string;
  proposer: string;
  proposed_owner: string;
  approvals: string[];
  status: 'Pending' | 'Timelocked' | 'Executed' | 'Cancelled' | 'Expired';
  timelock_until: number;
  expires_at: number;
  tx_hash?: string;
  created_at: string;
}

export async function getProposals() {
  return request<{ success: boolean; proposals: RecoveryProposal[] }>('/api/recovery/proposals');
}

export async function getProposalById(id: number | string) {
  return request<{ success: boolean; proposal: RecoveryProposal }>(`/api/recovery/proposals/${id}`);
}

export async function proposeRecovery(data: { proposed_owner: string }) {
  return request<{ success: boolean; proposal: RecoveryProposal }>('/api/recovery/propose', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function approveProposal(id: number | string) {
  return request<{ success: boolean; proposal: RecoveryProposal }>(
    `/api/recovery/proposals/${id}/approve`,
    {
      method: 'POST',
    }
  );
}

export async function cancelProposal(id: number | string) {
  return request<{ success: boolean; proposal: RecoveryProposal }>(
    `/api/recovery/proposals/${id}/cancel`,
    {
      method: 'POST',
    }
  );
}

export async function executeProposal(id: number | string) {
  return request<{ success: boolean; proposal: RecoveryProposal; newOwner: string; txHash: string }>(
    `/api/recovery/proposals/${id}/execute`,
    {
      method: 'POST',
    }
  );
}

// Security Events
export async function getSecurityEvents(params: { event_type?: string; search?: string; limit?: string } = {}) {
  const query = new URLSearchParams();
  if (params.event_type) query.set('event_type', params.event_type);
  if (params.search) query.set('search', params.search);
  if (params.limit) query.set('limit', params.limit);
  return request<{ success: boolean; events: any[] }>(`/api/events?${query.toString()}`);
}

export async function getSecurityStats() {
  return request<{
    success: boolean;
    stats: {
      totalEvents: number;
      rejectedTransfersCount: number;
      activeProposalsCount: number;
      completedRecoveriesCount: number;
      activeGuardiansCount: number;
      securityHealth: string;
      timelockEnforcement: string;
    };
  }>('/api/events/stats');
}
