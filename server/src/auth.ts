import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  wallet: string;
  role: 'owner' | 'guardian_1' | 'guardian_2' | 'guardian_3' | 'recovery_candidate' | 'user';
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const DEMO_PROFILES: Record<string, AuthUser> = {
  owner: {
    wallet: 'GAOWNER111111111111111111111111111111111111111111111111111',
    role: 'owner',
    name: 'Primary Wallet Owner',
  },
  guardian_1: {
    wallet: 'GAGUARDIAN11111111111111111111111111111111111111111111111111',
    role: 'guardian_1',
    name: 'Cold Vault Hardware Key (Guardian 1)',
  },
  guardian_2: {
    wallet: 'GAGUARDIAN22222222222222222222222222222222222222222222222222',
    role: 'guardian_2',
    name: 'Trusted Family Advisor (Guardian 2)',
  },
  guardian_3: {
    wallet: 'GAGUARDIAN33333333333333333333333333333333333333333333333333',
    role: 'guardian_3',
    name: 'Institutional Security Node (Guardian 3)',
  },
  recovery_candidate: {
    wallet: 'GARECOVERY99999999999999999999999999999999999999999999999999',
    role: 'recovery_candidate',
    name: 'Target Recovery Account',
  },
};

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const headerWallet = req.headers['x-wallet-address'] as string | undefined;
  const headerRole = req.headers['x-user-role'] as AuthUser['role'] | undefined;
  const demoRole = req.headers['x-demo-role'] as string | undefined;

  if (demoRole && DEMO_PROFILES[demoRole]) {
    req.user = DEMO_PROFILES[demoRole];
    return next();
  }

  if (headerWallet) {
    req.user = {
      wallet: headerWallet,
      role: headerRole || 'user',
    };
    return next();
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.wallet) {
    return res.status(401).json({
      error: 'Authentication required. Please connect your Stellar wallet or select a sandbox role.',
    });
  }
  next();
}
