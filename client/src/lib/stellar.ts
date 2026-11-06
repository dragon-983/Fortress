import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  signMessage,
  getNetworkDetails,
} from '@stellar/freighter-api';

export interface FreighterWalletState {
  installed: boolean;
  connected: boolean;
  address: string | null;
  network: string | null;
}

export async function checkFreighterStatus(): Promise<FreighterWalletState> {
  try {
    const installed = await isConnected();
    if (!installed) {
      return { installed: false, connected: false, address: null, network: null };
    }

    const hasAccess = await isAllowed();
    if (!hasAccess) {
      return { installed: true, connected: false, address: null, network: null };
    }

    const res: any = await requestAccess();
    const address = typeof res === 'string' ? res : res?.address || null;
    let network = 'TESTNET';
    try {
      const details = await getNetworkDetails();
      network = (details as any)?.network || 'TESTNET';
    } catch {
      // ignore
    }

    return {
      installed: true,
      connected: !!address,
      address,
      network,
    };
  } catch (err) {
    console.warn('Freighter status check error:', err);
    return { installed: false, connected: false, address: null, network: null };
  }
}

export async function connectFreighter(): Promise<string | null> {
  try {
    const installed = await isConnected();
    if (!installed) {
      throw new Error(
        'Freighter wallet extension is not installed. Please install it from freighter.app or use Sandbox Demo mode.'
      );
    }

    await setAllowed();
    const res: any = await requestAccess();
    const address = typeof res === 'string' ? res : res?.address || null;
    return address;
  } catch (err: any) {
    console.error('Freighter connection error:', err);
    throw err;
  }
}

export async function signAuthMessage(message: string): Promise<string> {
  const result: any = await signMessage(message);
  if (typeof result === 'string') return result;
  return result?.signedMessage || result?.signature || JSON.stringify(result);
}

export function formatAddress(address: string | null | undefined): string {
  if (!address) return '';
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function formatAmount(amount: number | string | null | undefined, decimals = 2): string {
  if (amount === null || amount === undefined) return '0.00';
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}
