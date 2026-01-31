import { storage } from "../storage";
import { encryptAddress, hashApiKey } from "../utils/encryption";
import { validateEvmAddress, validateTronAddress } from "../utils/addressValidation";
import type { Payment, Plan, Subscription, Network, Token } from "@shared/schema";

export interface PaymentConfig {
  paymentAddressEvm?: string;
  paymentAddressTron?: string;
  webhookUrl?: string;
  webhookSecret?: string;
}

export interface InitiatePaymentParams {
  userId: string;
  planId: string;
  network: Network;
  token: Token;
  senderAddress: string;
}

export interface PaymentResult {
  paymentId: string;
  amount: string;
  token: Token;
  network: Network;
  receiverAddress: string;
  expiresAt: Date;
  expiresIn: number;
}

export interface PaymentStatusResult {
  paymentId: string;
  status: string;
  amount: string;
  token: Token;
  network: Network;
  txHash: string | null;
  confirmedAt: Date | null;
}

const NETWORKS_INFO = {
  arbitrum: {
    id: 'arbitrum' as Network,
    name: 'Arbitrum One',
    chainId: 42161,
    tokens: ['USDT', 'USDC'] as Token[],
    estimatedFee: '$0.01',
    confirmationTime: '~1 minute',
    recommended: true,
  },
  ethereum: {
    id: 'ethereum' as Network,
    name: 'Ethereum',
    chainId: 1,
    tokens: ['USDT', 'USDC'] as Token[],
    estimatedFee: '$2-5',
    confirmationTime: '~5 minutes',
    recommended: false,
  },
  tron: {
    id: 'tron' as Network,
    name: 'Tron',
    tokens: ['USDT', 'USDC'] as Token[],
    estimatedFee: '$0.50',
    confirmationTime: '~3 minutes',
    recommended: false,
  },
};

class CryptoPaymentsLibrary {
  private config: PaymentConfig;

  constructor() {
    this.config = {
      paymentAddressEvm: process.env.PAYMENT_ADDRESS_EVM,
      paymentAddressTron: process.env.PAYMENT_ADDRESS_TRON,
      webhookUrl: process.env.WEBHOOK_URL,
      webhookSecret: process.env.WEBHOOK_SECRET,
    };
  }

  configure(config: Partial<PaymentConfig>) {
    this.config = { ...this.config, ...config };
  }

  getNetworks() {
    return Object.values(NETWORKS_INFO);
  }

  getNetwork(networkId: Network) {
    return NETWORKS_INFO[networkId];
  }

  async createPlan(params: {
    planKey: string;
    name: string;
    description?: string;
    price: string;
    currency?: Token;
    periodDays?: number;
    features?: string[];
  }): Promise<Plan> {
    return storage.createPlan({
      tenantId: 'default',
      planKey: params.planKey,
      name: params.name,
      description: params.description || null,
      price: params.price,
      currency: params.currency || 'USDC',
      periodDays: params.periodDays || null,
      features: params.features || null,
      isActive: true,
    });
  }

  async getPlans(): Promise<Plan[]> {
    return storage.getPlansByTenant('default');
  }

  async getPlan(planId: string): Promise<Plan | undefined> {
    return storage.getPlan(planId);
  }

  async getPlanByKey(planKey: string): Promise<Plan | undefined> {
    return storage.getPlanByKey('default', planKey);
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<PaymentResult> {
    const { userId, planId, network, token, senderAddress } = params;

    const plan = await storage.getPlan(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    if (network === 'tron') {
      const result = validateTronAddress(senderAddress);
      if (!result.valid) {
        throw new Error(result.error || 'Invalid Tron address');
      }
    } else {
      const result = validateEvmAddress(senderAddress);
      if (!result.valid) {
        throw new Error(result.error || 'Invalid Ethereum address');
      }
    }

    const receiverAddress = network === 'tron' 
      ? this.config.paymentAddressTron 
      : this.config.paymentAddressEvm;

    if (!receiverAddress) {
      throw new Error(`Payment address not configured for network: ${network}`);
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const senderAddressHmac = hashApiKey(senderAddress);
    const senderAddressEncrypted = encryptAddress(senderAddress);

    const payment = await storage.createPayment({
      tenantId: 'default',
      planId,
      externalUserId: userId,
      amount: plan.price,
      token,
      network,
      senderAddressEncrypted,
      senderAddressHmac,
      receiverAddress,
      status: 'pending',
      expiresAt,
    });

    return {
      paymentId: payment.id,
      amount: plan.price,
      token,
      network,
      receiverAddress,
      expiresAt,
      expiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    };
  }

  async confirmPaymentSent(paymentId: string): Promise<PaymentStatusResult> {
    const payment = await storage.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'pending') {
      await storage.updatePayment(paymentId, { status: 'awaiting_confirmation' });
    }

    return this.getPaymentStatus(paymentId);
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    const payment = await storage.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    return {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      token: payment.token,
      network: payment.network,
      txHash: payment.txHash,
      confirmedAt: payment.txConfirmedAt,
    };
  }

  async getPaymentHistory(userId: string, limit = 10): Promise<Payment[]> {
    return storage.getPaymentsByTenantUser('default', userId, limit);
  }

  async getCurrentSubscription(userId: string): Promise<Subscription | null> {
    const subscription = await storage.getActiveSubscription('default', userId);
    return subscription || null;
  }

  async getSubscriptionHistory(userId: string): Promise<Subscription[]> {
    return storage.getSubscriptionsByTenantUser('default', userId);
  }

  async cancelPayment(paymentId: string): Promise<boolean> {
    const payment = await storage.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'pending' && payment.status !== 'awaiting_confirmation') {
      throw new Error('Cannot cancel payment in current status');
    }

    await storage.updatePayment(paymentId, { status: 'cancelled' });
    return true;
  }

  validateAddress(address: string, network: Network): { valid: boolean; error?: string } {
    if (network === 'tron') {
      return validateTronAddress(address);
    }
    return validateEvmAddress(address);
  }
}

export const cryptoPayments = new CryptoPaymentsLibrary();
export { CryptoPaymentsLibrary };
