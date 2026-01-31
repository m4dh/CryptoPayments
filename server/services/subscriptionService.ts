import { storage } from "../storage";
import type { Subscription, Payment, Plan } from "@shared/schema";

export interface SubscriptionInfo {
  hasSubscription: boolean;
  subscription: {
    id: string;
    planId: string;
    planName: string;
    status: string;
    startsAt: Date;
    endsAt: Date | null;
    daysRemaining: number | null;
    paymentId: string | null;
  } | null;
  defaultPlan?: string;
}

class SubscriptionService {
  async activateSubscription(payment: Payment): Promise<Subscription> {
    const plan = await storage.getPlan(payment.planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const startsAt = new Date();
    let endsAt: Date | null = null;

    if (plan.periodDays && plan.periodDays > 0) {
      endsAt = new Date(startsAt.getTime() + plan.periodDays * 24 * 60 * 60 * 1000);
    }

    const existingSubscription = await storage.getActiveSubscription(
      payment.tenantId,
      payment.externalUserId
    );
    
    if (existingSubscription) {
      await storage.updateSubscription(existingSubscription.id, { status: 'expired' });
    }

    const subscription = await storage.createSubscription({
      tenantId: payment.tenantId,
      externalUserId: payment.externalUserId,
      planId: payment.planId,
      paymentId: payment.id,
      status: 'active',
      startsAt,
      endsAt,
    });

    return subscription;
  }

  async getCurrentSubscription(tenantId: string, externalUserId: string): Promise<SubscriptionInfo> {
    const subscription = await storage.getActiveSubscription(tenantId, externalUserId);

    if (!subscription) {
      return {
        hasSubscription: false,
        subscription: null,
        defaultPlan: 'free',
      };
    }

    const plan = await storage.getPlan(subscription.planId);
    const planName = plan?.name || 'Unknown';

    let daysRemaining: number | null = null;
    if (subscription.endsAt) {
      const msRemaining = subscription.endsAt.getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
    }

    return {
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        planName,
        status: subscription.status,
        startsAt: subscription.startsAt,
        endsAt: subscription.endsAt,
        daysRemaining,
        paymentId: subscription.paymentId,
      },
    };
  }

  async isSubscriptionActive(tenantId: string, externalUserId: string): Promise<boolean> {
    const subscription = await storage.getActiveSubscription(tenantId, externalUserId);
    return !!subscription;
  }

  async getSubscriptionHistory(tenantId: string, externalUserId: string): Promise<Subscription[]> {
    return storage.getSubscriptionsByTenantUser(tenantId, externalUserId);
  }

  async checkAndExpireSubscriptions(): Promise<number> {
    const now = new Date();
    const expiredSubscriptions = await storage.getExpiredSubscriptions(now);
    
    let count = 0;
    for (const subscription of expiredSubscriptions) {
      await storage.updateSubscription(subscription.id, { status: 'expired' });
      count++;
    }
    
    return count;
  }
}

export const subscriptionService = new SubscriptionService();
