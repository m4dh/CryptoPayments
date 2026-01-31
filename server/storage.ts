import { 
  tenants, plans, payments, subscriptions, webhookLogs,
  type Tenant, type InsertTenant,
  type Plan, type InsertPlan,
  type Payment, type InsertPayment,
  type Subscription, type InsertSubscription,
  type WebhookLog, type InsertWebhookLog,
  type PaymentStatus, type SubscriptionStatus
} from "@shared/schema";
import { db } from "./db";
import { eq, and, lt, or, desc, inArray } from "drizzle-orm";

export interface IStorage {
  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByApiKeyHash(apiKeyHash: string): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant | undefined>;
  deleteTenant(id: string): Promise<boolean>;
  
  // Plans
  getPlan(id: string): Promise<Plan | undefined>;
  getPlanByKey(tenantId: string, planKey: string): Promise<Plan | undefined>;
  getPlansByTenant(tenantId: string): Promise<Plan[]>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: string, data: Partial<Plan>): Promise<Plan | undefined>;
  
  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentByTxHash(txHash: string): Promise<Payment | undefined>;
  getPaymentsByTenantUser(tenantId: string, externalUserId: string, limit?: number): Promise<Payment[]>;
  getPaymentsByStatus(status: PaymentStatus): Promise<Payment[]>;
  getPendingPaymentForUser(tenantId: string, externalUserId: string): Promise<Payment | undefined>;
  getExpiredPayments(now: Date): Promise<Payment[]>;
  getAwaitingConfirmationPayments(): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined>;
  
  // Subscriptions
  getSubscription(id: string): Promise<Subscription | undefined>;
  getActiveSubscription(tenantId: string, externalUserId: string): Promise<Subscription | undefined>;
  getSubscriptionsByTenantUser(tenantId: string, externalUserId: string): Promise<Subscription[]>;
  getExpiredSubscriptions(now: Date): Promise<Subscription[]>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription | undefined>;
  
  // Webhook Logs
  createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog>;
  updateWebhookLog(id: string, data: Partial<WebhookLog>): Promise<WebhookLog | undefined>;
  getPendingWebhooks(): Promise<WebhookLog[]>;
}

export class DatabaseStorage implements IStorage {
  // Tenants
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async getTenantByApiKeyHash(apiKeyHash: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.apiKeyHash, apiKeyHash));
    return tenant || undefined;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    return created;
  }

  async updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTenant(id: string): Promise<boolean> {
    const result = await db.delete(tenants).where(eq(tenants.id, id));
    return true;
  }

  // Plans
  async getPlan(id: string): Promise<Plan | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id));
    return plan || undefined;
  }

  async getPlanByKey(tenantId: string, planKey: string): Promise<Plan | undefined> {
    const [plan] = await db.select().from(plans)
      .where(and(eq(plans.tenantId, tenantId), eq(plans.planKey, planKey)));
    return plan || undefined;
  }

  async getPlansByTenant(tenantId: string): Promise<Plan[]> {
    return db.select().from(plans)
      .where(and(eq(plans.tenantId, tenantId), eq(plans.isActive, true)));
  }

  async createPlan(plan: InsertPlan): Promise<Plan> {
    const [created] = await db.insert(plans).values(plan).returning();
    return created;
  }

  async updatePlan(id: string, data: Partial<Plan>): Promise<Plan | undefined> {
    const [updated] = await db.update(plans)
      .set(data)
      .where(eq(plans.id, id))
      .returning();
    return updated || undefined;
  }

  // Payments
  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async getPaymentByTxHash(txHash: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.txHash, txHash));
    return payment || undefined;
  }

  async getPaymentsByTenantUser(tenantId: string, externalUserId: string, limit = 50): Promise<Payment[]> {
    return db.select().from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.externalUserId, externalUserId)))
      .orderBy(desc(payments.createdAt))
      .limit(limit);
  }

  async getPaymentsByStatus(status: PaymentStatus): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.status, status));
  }

  async getPendingPaymentForUser(tenantId: string, externalUserId: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.externalUserId, externalUserId),
        or(eq(payments.status, 'pending'), eq(payments.status, 'awaiting_confirmation'))
      ));
    return payment || undefined;
  }

  async getExpiredPayments(now: Date): Promise<Payment[]> {
    return db.select().from(payments)
      .where(and(
        lt(payments.expiresAt, now),
        or(eq(payments.status, 'pending'), eq(payments.status, 'awaiting_confirmation'))
      ));
  }

  async getAwaitingConfirmationPayments(): Promise<Payment[]> {
    return db.select().from(payments)
      .where(eq(payments.status, 'awaiting_confirmation'));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [created] = await db.insert(payments).values(payment).returning();
    return created;
  }

  async updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined> {
    const [updated] = await db.update(payments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return updated || undefined;
  }

  // Subscriptions
  async getSubscription(id: string): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return subscription || undefined;
  }

  async getActiveSubscription(tenantId: string, externalUserId: string): Promise<Subscription | undefined> {
    const now = new Date();
    const [subscription] = await db.select().from(subscriptions)
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.externalUserId, externalUserId),
        eq(subscriptions.status, 'active'),
        or(
          eq(subscriptions.endsAt, null as any),
          lt(now, subscriptions.endsAt!)
        )
      ))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return subscription || undefined;
  }

  async getSubscriptionsByTenantUser(tenantId: string, externalUserId: string): Promise<Subscription[]> {
    return db.select().from(subscriptions)
      .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.externalUserId, externalUserId)))
      .orderBy(desc(subscriptions.createdAt));
  }

  async getExpiredSubscriptions(now: Date): Promise<Subscription[]> {
    return db.select().from(subscriptions)
      .where(and(
        eq(subscriptions.status, 'active'),
        lt(subscriptions.endsAt!, now)
      ));
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [created] = await db.insert(subscriptions).values(subscription).returning();
    return created;
  }

  async updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription | undefined> {
    const [updated] = await db.update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return updated || undefined;
  }

  // Webhook Logs
  async createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog> {
    const [created] = await db.insert(webhookLogs).values(log).returning();
    return created;
  }

  async updateWebhookLog(id: string, data: Partial<WebhookLog>): Promise<WebhookLog | undefined> {
    const [updated] = await db.update(webhookLogs)
      .set(data)
      .where(eq(webhookLogs.id, id))
      .returning();
    return updated || undefined;
  }

  async getPendingWebhooks(): Promise<WebhookLog[]> {
    const now = new Date();
    return db.select().from(webhookLogs)
      .where(and(
        eq(webhookLogs.success, false),
        lt(webhookLogs.retryCount!, 4),
        or(
          eq(webhookLogs.nextRetryAt, null as any),
          lt(webhookLogs.nextRetryAt!, now)
        )
      ));
  }
}

export const storage = new DatabaseStorage();
