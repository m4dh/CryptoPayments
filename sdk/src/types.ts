export type PaymentStatus = 'pending' | 'awaiting_confirmation' | 'confirmed' | 'expired' | 'failed' | 'cancelled';
export type Network = 'arbitrum' | 'ethereum' | 'tron';
export type Token = 'USDT' | 'USDC';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';
export type WebhookEvent = 'payment.created' | 'payment.confirmed' | 'payment.expired' | 'payment.failed' | 'subscription.activated' | 'subscription.expired';

export interface CryptoPaymentSDKConfig {
  apiKey: string;
  apiUrl: string;
  webhookSecret?: string;
  timeout?: number;
}

export interface NetworkInfo {
  id: Network;
  name: string;
  chainId?: number;
  tokens: Token[];
  estimatedFee: string;
  confirmationTime: string;
  recommended: boolean;
}

export interface Plan {
  id: string;
  planKey: string;
  name: string;
  description: string | null;
  price: string;
  currency: Token;
  periodDays: number | null;
  features: string[] | null;
  isActive: boolean;
}

export interface InitiatePaymentParams {
  externalUserId: string;
  planId: string;
  network: Network;
  token: Token;
  senderAddress: string;
}

export interface InitiatePaymentResult {
  paymentId: string;
  receiverAddress: string;
  amount: string;
  token: Token;
  network: Network;
  expiresAt: string;
  expiresIn: number;
  qrCodeData: string;
  instructions: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
  };
}

export interface PaymentStatusResult {
  paymentId: string;
  status: PaymentStatus;
  amount: string;
  token: Token;
  network: Network;
  receiverAddress: string;
  expiresAt?: string;
  expiresIn?: number;
  txHash?: string;
  txUrl?: string;
  confirmations?: number;
  confirmedAt?: string;
  checkingBlockchain?: boolean;
  lastChecked?: string;
  errorMessage?: string;
}

export interface PaymentHistoryItem {
  id: string;
  planId: string;
  amount: string;
  token: Token;
  network: Network;
  status: PaymentStatus;
  txHash?: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface SubscriptionInfo {
  hasSubscription: boolean;
  subscription: {
    id: string;
    planId: string;
    planName: string;
    status: SubscriptionStatus;
    startsAt: string;
    endsAt: string | null;
    daysRemaining: number | null;
    paymentId: string | null;
  } | null;
  defaultPlan?: string;
}

export interface AddressValidationResult {
  valid: boolean;
  address: string;
  network: Network;
  checksumAddress?: string;
  error?: string;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
}

export interface TenantInfo {
  id: string;
  name: string;
  webhookUrl: string | null;
  paymentAddressEvm: string | null;
  paymentAddressTron: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreatePlanParams {
  planKey: string;
  name: string;
  description?: string;
  price: string;
  currency?: Token;
  periodDays?: number;
  features?: string[];
}

export interface ApiError {
  error: string;
  message: string;
  details?: any;
}
