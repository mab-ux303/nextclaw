export type Role = 'admin' | 'user';

export type UserView = {
  id: string;
  email: string;
  role: Role;
  freeLimitUsd: number;
  freeUsedUsd: number;
  freeRemainingUsd: number;
  paidBalanceUsd: number;
  createdAt: string;
  updatedAt: string;
};

export type AuthResult = {
  token: string;
  user: UserView;
};

export type BillingOverview = {
  user: UserView;
  globalFreeLimitUsd: number;
  globalFreeUsedUsd: number;
  globalFreeRemainingUsd: number;
};

export type LedgerItem = {
  id: string;
  userId: string;
  kind: string;
  amountUsd: number;
  freeAmountUsd: number;
  paidAmountUsd: number;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  requestId: string | null;
  note: string | null;
  createdAt: string;
};

export type RechargeIntentItem = {
  id: string;
  userId: string;
  amountUsd: number;
  status: 'pending' | 'confirmed' | 'rejected';
  note: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  confirmedByUserId: string | null;
  rejectedAt: string | null;
  rejectedByUserId: string | null;
};

export type AdminOverview = {
  globalFreeLimitUsd: number;
  globalFreeUsedUsd: number;
  globalFreeRemainingUsd: number;
  userCount: number;
  pendingRechargeIntents: number;
};

export type RemoteDevice = {
  id: string;
  deviceInstallId: string;
  displayName: string;
  platform: string;
  appVersion: string;
  localOrigin: string;
  status: 'online' | 'offline';
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type RemoteSession = {
  id: string;
  deviceId: string;
  status: 'active' | 'closed' | 'expired';
  expiresAt: string;
  lastUsedAt: string;
  createdAt: string;
  openUrl: string;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ApiEnvelope<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};
