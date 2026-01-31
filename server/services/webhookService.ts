import { storage } from "../storage";
import { signWebhookPayload } from "../utils/encryption";
import { WEBHOOK_RETRY_DELAYS } from "../config/networks";
import type { Payment, Subscription, WebhookEvent, Tenant } from "@shared/schema";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
}

class WebhookService {
  async sendPaymentCreated(payment: Payment): Promise<void> {
    await this.sendWebhook(payment.tenantId, 'payment.created', {
      paymentId: payment.id,
      externalUserId: payment.externalUserId,
      planId: payment.planId,
      amount: payment.amount,
      token: payment.token,
      network: payment.network,
      status: payment.status,
      expiresAt: payment.expiresAt.toISOString(),
    });
  }

  async sendPaymentConfirmed(payment: Payment): Promise<void> {
    await this.sendWebhook(payment.tenantId, 'payment.confirmed', {
      paymentId: payment.id,
      externalUserId: payment.externalUserId,
      planId: payment.planId,
      amount: payment.amount,
      token: payment.token,
      network: payment.network,
      txHash: payment.txHash,
      confirmations: payment.confirmations,
      confirmedAt: payment.txConfirmedAt?.toISOString(),
    });
  }

  async sendPaymentExpired(payment: Payment): Promise<void> {
    await this.sendWebhook(payment.tenantId, 'payment.expired', {
      paymentId: payment.id,
      externalUserId: payment.externalUserId,
      planId: payment.planId,
      amount: payment.amount,
      token: payment.token,
      network: payment.network,
    });
  }

  async sendPaymentFailed(payment: Payment, error: string): Promise<void> {
    await this.sendWebhook(payment.tenantId, 'payment.failed', {
      paymentId: payment.id,
      externalUserId: payment.externalUserId,
      planId: payment.planId,
      amount: payment.amount,
      token: payment.token,
      network: payment.network,
      error,
    });
  }

  async sendSubscriptionActivated(subscription: Subscription): Promise<void> {
    await this.sendWebhook(subscription.tenantId, 'subscription.activated', {
      subscriptionId: subscription.id,
      externalUserId: subscription.externalUserId,
      planId: subscription.planId,
      paymentId: subscription.paymentId,
      startsAt: subscription.startsAt.toISOString(),
      endsAt: subscription.endsAt?.toISOString() || null,
    });
  }

  async sendSubscriptionExpired(subscription: Subscription): Promise<void> {
    await this.sendWebhook(subscription.tenantId, 'subscription.expired', {
      subscriptionId: subscription.id,
      externalUserId: subscription.externalUserId,
      planId: subscription.planId,
      endsAt: subscription.endsAt?.toISOString() || null,
    });
  }

  private async sendWebhook(tenantId: string, event: WebhookEvent, data: Record<string, any>): Promise<void> {
    const tenant = await storage.getTenant(tenantId);
    if (!tenant || !tenant.webhookUrl) {
      console.log(`[Webhook] No webhook URL configured for tenant ${tenantId}`);
      return;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const payloadString = JSON.stringify(payload);

    const log = await storage.createWebhookLog({
      tenantId,
      event,
      payload: payloadString,
      url: tenant.webhookUrl,
      success: false,
      retryCount: 0,
    });

    await this.deliverWebhook(log.id, tenant, payloadString);
  }

  private async deliverWebhook(logId: string, tenant: Tenant, payload: string): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (tenant.webhookSecret) {
        const signature = signWebhookPayload(payload, tenant.webhookSecret);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(tenant.webhookUrl!, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      const responseBody = await response.text();

      await storage.updateWebhookLog(logId, {
        responseStatus: response.status,
        responseBody: responseBody.substring(0, 1000),
        success: response.ok,
      });

      if (!response.ok) {
        console.error(`[Webhook] Failed to deliver webhook ${logId}: ${response.status}`);
        await this.scheduleRetry(logId);
      } else {
        console.log(`[Webhook] Successfully delivered webhook ${logId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Webhook] Error delivering webhook ${logId}:`, errorMessage);
      
      await storage.updateWebhookLog(logId, {
        responseBody: errorMessage,
        success: false,
      });

      await this.scheduleRetry(logId);
    }
  }

  private async scheduleRetry(logId: string): Promise<void> {
    const log = await storage.getPendingWebhooks().then(logs => logs.find(l => l.id === logId));
    if (!log) return;

    const retryCount = (log.retryCount || 0) + 1;
    if (retryCount >= WEBHOOK_RETRY_DELAYS.length) {
      console.log(`[Webhook] Max retries exceeded for webhook ${logId}`);
      return;
    }

    const delaySeconds = WEBHOOK_RETRY_DELAYS[retryCount];
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

    await storage.updateWebhookLog(logId, {
      retryCount,
      nextRetryAt,
    });

    console.log(`[Webhook] Scheduled retry ${retryCount} for webhook ${logId} at ${nextRetryAt.toISOString()}`);
  }

  async retryPendingWebhooks(): Promise<number> {
    const pendingWebhooks = await storage.getPendingWebhooks();
    let count = 0;

    for (const log of pendingWebhooks) {
      const tenant = await storage.getTenant(log.tenantId);
      if (!tenant || !tenant.webhookUrl) continue;

      await this.deliverWebhook(log.id, tenant, log.payload);
      count++;
    }

    return count;
  }
}

export const webhookService = new WebhookService();
