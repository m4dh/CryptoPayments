import { storage } from "../storage";
import { encryptAddress, generateAddressHmac } from "../utils/encryption";
import { validateAddress, normalizeAddress } from "../utils/addressValidation";
import { getNetworkConfig, PAYMENT_TIMEOUT_MINUTES, getTxExplorerUrl } from "../config/networks";
import type { Payment, Plan, Network, Token, PaymentStatus } from "@shared/schema";

export interface InitiatePaymentParams {
  tenantId: string;
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
  expiresAt: Date;
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
  expiresAt?: Date;
  expiresIn?: number;
  txHash?: string;
  txUrl?: string;
  confirmations?: number;
  confirmedAt?: Date;
  checkingBlockchain?: boolean;
  lastChecked?: Date;
  errorMessage?: string;
}

class PaymentService {
  async getPlans(tenantId: string): Promise<Plan[]> {
    return storage.getPlansByTenant(tenantId);
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const { tenantId, externalUserId, planId, network, token, senderAddress } = params;

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const plan = await storage.getPlan(planId);
    if (!plan || plan.tenantId !== tenantId || !plan.isActive) {
      throw new Error('Plan not found or not available');
    }

    const addressValidation = validateAddress(senderAddress, network);
    if (!addressValidation.valid) {
      throw new Error(addressValidation.error || 'Invalid sender address');
    }

    const existingPayment = await storage.getPendingPaymentForUser(tenantId, externalUserId);
    if (existingPayment) {
      throw new Error('User already has a pending payment');
    }

    const receiverAddress = network === 'tron' 
      ? (tenant.paymentAddressTron || process.env.PAYMENT_ADDRESS_TRON)
      : (tenant.paymentAddressEvm || process.env.PAYMENT_ADDRESS_EVM);

    if (!receiverAddress) {
      throw new Error('Payment address not configured for this network');
    }

    const normalizedSenderAddress = normalizeAddress(senderAddress, network);
    const senderAddressEncrypted = encryptAddress(normalizedSenderAddress);
    const senderAddressHmac = generateAddressHmac(normalizedSenderAddress);

    const expiresAt = new Date(Date.now() + PAYMENT_TIMEOUT_MINUTES * 60 * 1000);
    const amount = plan.price;

    const payment = await storage.createPayment({
      tenantId,
      externalUserId,
      planId,
      amount: amount.toString(),
      token,
      network,
      senderAddressEncrypted,
      senderAddressHmac,
      receiverAddress,
      status: 'pending',
      expiresAt,
    });

    const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    return {
      paymentId: payment.id,
      receiverAddress,
      amount: amount.toString(),
      token,
      network,
      expiresAt,
      expiresIn,
      qrCodeData: receiverAddress,
      instructions: {
        step1: 'Open your wallet (MetaMask, Trust Wallet, TronLink, etc.)',
        step2: `Send exactly ${amount} ${token} to the address shown`,
        step3: 'Wait for transaction confirmation',
        step4: 'Click "I have paid" after sending',
      },
    };
  }

  async confirmPayment(paymentId: string, tenantId: string): Promise<void> {
    const payment = await storage.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    if (payment.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }
    if (payment.status !== 'pending') {
      throw new Error(`Cannot confirm payment in status: ${payment.status}`);
    }
    if (new Date() > payment.expiresAt) {
      await storage.updatePayment(paymentId, { status: 'expired' });
      throw new Error('Payment has expired');
    }

    await storage.updatePayment(paymentId, { status: 'awaiting_confirmation' });
  }

  async getPaymentStatus(paymentId: string, tenantId: string): Promise<PaymentStatusResult> {
    const payment = await storage.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    if (payment.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    const networkConfig = getNetworkConfig(payment.network as Network);
    const result: PaymentStatusResult = {
      paymentId: payment.id,
      status: payment.status as PaymentStatus,
      amount: payment.amount,
      token: payment.token as Token,
      network: payment.network as Network,
      receiverAddress: payment.receiverAddress,
    };

    if (payment.status === 'pending' || payment.status === 'awaiting_confirmation') {
      result.expiresAt = payment.expiresAt;
      result.expiresIn = Math.max(0, Math.floor((payment.expiresAt.getTime() - Date.now()) / 1000));
    }

    if (payment.status === 'awaiting_confirmation') {
      result.checkingBlockchain = true;
      result.lastChecked = payment.updatedAt;
    }

    if (payment.status === 'confirmed' && payment.txHash) {
      result.txHash = payment.txHash;
      result.txUrl = getTxExplorerUrl(payment.network as Network, payment.txHash);
      result.confirmations = payment.confirmations || 0;
      result.confirmedAt = payment.txConfirmedAt || undefined;
    }

    if (payment.status === 'failed') {
      result.errorMessage = payment.errorMessage || 'Payment verification failed';
    }

    return result;
  }

  async cancelPayment(paymentId: string, tenantId: string): Promise<void> {
    const payment = await storage.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    if (payment.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }
    if (payment.status !== 'pending') {
      throw new Error('Only pending payments can be cancelled');
    }

    await storage.updatePayment(paymentId, { status: 'cancelled' });
  }

  async getPaymentHistory(tenantId: string, externalUserId: string, limit = 20): Promise<Payment[]> {
    return storage.getPaymentsByTenantUser(tenantId, externalUserId, limit);
  }

  async handleConfirmedTransaction(
    paymentId: string,
    txHash: string,
    confirmations: number,
    amount: string
  ): Promise<void> {
    const payment = await storage.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const existingWithTxHash = await storage.getPaymentByTxHash(txHash);
    if (existingWithTxHash && existingWithTxHash.id !== paymentId) {
      throw new Error('Transaction already used for another payment');
    }

    await storage.updatePayment(paymentId, {
      status: 'confirmed',
      txHash,
      confirmations,
      txConfirmedAt: new Date(),
    });
  }

  async expireOldPayments(): Promise<number> {
    const now = new Date();
    const expiredPayments = await storage.getExpiredPayments(now);
    
    let count = 0;
    for (const payment of expiredPayments) {
      await storage.updatePayment(payment.id, { status: 'expired' });
      count++;
    }
    
    return count;
  }

  async getAwaitingPayments(): Promise<Payment[]> {
    return storage.getAwaitingConfirmationPayments();
  }
}

export const paymentService = new PaymentService();
