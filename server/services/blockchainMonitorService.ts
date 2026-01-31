import { storage } from "../storage";
import { paymentService } from "./paymentService";
import { subscriptionService } from "./subscriptionService";
import { webhookService } from "./webhookService";
import { evmBlockchainService } from "./evmBlockchainService";
import { tronBlockchainService } from "./tronBlockchainService";
import { isEvmNetwork, MAX_RETRY_COUNT } from "../config/networks";
import type { Payment, Network } from "@shared/schema";

interface MonitoredPayment {
  id: string;
  retryCount: number;
  lastChecked: Date;
}

class BlockchainMonitorService {
  private monitoringQueue: Map<string, MonitoredPayment> = new Map();
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log('[Monitor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[Monitor] Starting blockchain monitor service...');

    this.intervalId = setInterval(() => {
      this.processQueue().catch(err => {
        console.error('[Monitor] Error processing queue:', err);
      });
    }, 30000);

    await this.loadPendingPayments();
    await this.processQueue();
  }

  stopMonitoring(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[Monitor] Stopped blockchain monitor service');
  }

  private async loadPendingPayments(): Promise<void> {
    try {
      const awaitingPayments = await paymentService.getAwaitingPayments();
      for (const payment of awaitingPayments) {
        this.addToQueue(payment.id);
      }
      console.log(`[Monitor] Loaded ${awaitingPayments.length} payments to monitor`);
    } catch (error) {
      console.error('[Monitor] Error loading pending payments:', error);
    }
  }

  addToQueue(paymentId: string): void {
    if (!this.monitoringQueue.has(paymentId)) {
      this.monitoringQueue.set(paymentId, {
        id: paymentId,
        retryCount: 0,
        lastChecked: new Date(0),
      });
      console.log(`[Monitor] Added payment ${paymentId} to queue`);
    }
  }

  removeFromQueue(paymentId: string): void {
    this.monitoringQueue.delete(paymentId);
    console.log(`[Monitor] Removed payment ${paymentId} from queue`);
  }

  isInQueue(paymentId: string): boolean {
    return this.monitoringQueue.has(paymentId);
  }

  getQueueSize(): number {
    return this.monitoringQueue.size;
  }

  private async processQueue(): Promise<void> {
    if (this.monitoringQueue.size === 0) {
      return;
    }

    console.log(`[Monitor] Processing ${this.monitoringQueue.size} payments...`);

    for (const [paymentId, monitoredPayment] of this.monitoringQueue) {
      try {
        await this.checkPayment(paymentId, monitoredPayment);
      } catch (error) {
        console.error(`[Monitor] Error checking payment ${paymentId}:`, error);
        
        monitoredPayment.retryCount++;
        if (monitoredPayment.retryCount >= MAX_RETRY_COUNT) {
          console.log(`[Monitor] Max retries exceeded for payment ${paymentId}`);
          await this.handleMonitoringFailure(paymentId, 'Max retries exceeded');
        }
      }
    }
  }

  private async checkPayment(paymentId: string, monitoredPayment: MonitoredPayment): Promise<void> {
    const payment = await storage.getPayment(paymentId);
    if (!payment) {
      this.removeFromQueue(paymentId);
      return;
    }

    if (payment.status !== 'awaiting_confirmation') {
      this.removeFromQueue(paymentId);
      return;
    }

    if (new Date() > payment.expiresAt) {
      await this.handlePaymentExpired(payment);
      return;
    }

    const network = payment.network as Network;
    let result;

    if (isEvmNetwork(network)) {
      result = await evmBlockchainService.findTransfer(payment);
    } else {
      result = await tronBlockchainService.findTransfer(payment);
    }

    monitoredPayment.lastChecked = new Date();

    if (result.found && result.txHash) {
      await this.handlePaymentConfirmed(payment, result.txHash, result.confirmations || 0, result.amount || payment.amount);
    }
  }

  private async handlePaymentConfirmed(
    payment: Payment,
    txHash: string,
    confirmations: number,
    amount: string
  ): Promise<void> {
    console.log(`[Monitor] Payment ${payment.id} confirmed with tx ${txHash}`);

    try {
      await paymentService.handleConfirmedTransaction(
        payment.id,
        txHash,
        confirmations,
        amount
      );

      const updatedPayment = await storage.getPayment(payment.id);
      if (updatedPayment) {
        await webhookService.sendPaymentConfirmed(updatedPayment);

        const subscription = await subscriptionService.activateSubscription(updatedPayment);
        await webhookService.sendSubscriptionActivated(subscription);
      }

      this.removeFromQueue(payment.id);
    } catch (error) {
      console.error(`[Monitor] Error handling confirmed payment ${payment.id}:`, error);
    }
  }

  private async handlePaymentExpired(payment: Payment): Promise<void> {
    console.log(`[Monitor] Payment ${payment.id} expired`);

    await storage.updatePayment(payment.id, { status: 'expired' });
    await webhookService.sendPaymentExpired(payment);
    this.removeFromQueue(payment.id);
  }

  private async handleMonitoringFailure(paymentId: string, error: string): Promise<void> {
    const payment = await storage.getPayment(paymentId);
    if (payment) {
      await storage.updatePayment(paymentId, {
        status: 'failed',
        errorMessage: error,
      });
      await webhookService.sendPaymentFailed(payment, error);
    }
    this.removeFromQueue(paymentId);
  }
}

export const blockchainMonitorService = new BlockchainMonitorService();
