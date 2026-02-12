import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, index, unique, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'awaiting_confirmation',
  'confirmed',
  'expired',
  'failed',
  'cancelled'
]);

export const networkEnum = pgEnum('network', ['arbitrum', 'ethereum', 'tron']);
export const tokenEnum = pgEnum('token', ['USDT', 'USDC']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'expired', 'cancelled']);
export const webhookEventEnum = pgEnum('webhook_event', [
  'payment.created',
  'payment.confirmed',
  'payment.expired',
  'payment.failed',
  'subscription.activated',
  'subscription.expired'
]);

// Tenants - multi-tenant support
export const tenants = pgTable("tenants", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  apiKey: varchar("api_key", { length: 64 }).notNull().unique(),
  apiKeyHash: varchar("api_key_hash", { length: 128 }).notNull(),
  webhookUrl: text("webhook_url"),
  webhookSecret: varchar("webhook_secret", { length: 64 }),
  paymentAddressEvm: varchar("payment_address_evm", { length: 42 }),
  paymentAddressTron: varchar("payment_address_tron", { length: 34 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Plans - subscription plans per tenant
export const plans = pgTable("plans", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  planKey: varchar("plan_key", { length: 50 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 18, scale: 6 }).notNull(),
  currency: tokenEnum("currency").notNull().default('USDC'),
  periodDays: integer("period_days"),
  features: text("features").array(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantPlanIdx: index("idx_plans_tenant").on(table.tenantId),
  uniqueTenantPlan: unique("unique_tenant_plan").on(table.tenantId, table.planKey),
}));

// Payments
export const payments = pgTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  externalUserId: varchar("external_user_id", { length: 255 }).notNull(),
  planId: varchar("plan_id", { length: 36 }).notNull().references(() => plans.id),
  
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  token: tokenEnum("token").notNull(),
  network: networkEnum("network").notNull(),
  
  senderAddressEncrypted: text("sender_address_encrypted").notNull(),
  senderAddressHmac: varchar("sender_address_hmac", { length: 128 }).notNull(),
  receiverAddress: varchar("receiver_address", { length: 100 }).notNull(),
  
  status: paymentStatusEnum("status").notNull().default('pending'),
  
  txHash: varchar("tx_hash", { length: 100 }),
  txConfirmedAt: timestamp("tx_confirmed_at"),
  confirmations: integer("confirmations").default(0),
  
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => ({
  statusIdx: index("idx_payments_status").on(table.status),
  senderHmacIdx: index("idx_payments_sender_hmac").on(table.senderAddressHmac),
  tenantUserIdx: index("idx_payments_tenant_user").on(table.tenantId, table.externalUserId),
  expiresIdx: index("idx_payments_expires").on(table.expiresAt),
  txHashIdx: index("idx_payments_tx_hash").on(table.txHash),
}));

// Subscriptions
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  externalUserId: varchar("external_user_id", { length: 255 }).notNull(),
  planId: varchar("plan_id", { length: 36 }).notNull().references(() => plans.id),
  paymentId: varchar("payment_id", { length: 36 }).references(() => payments.id),
  
  status: subscriptionStatusEnum("status").notNull().default('active'),
  
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantUserIdx: index("idx_subscriptions_tenant_user").on(table.tenantId, table.externalUserId),
  statusIdx: index("idx_subscriptions_status").on(table.status),
  endsAtIdx: index("idx_subscriptions_ends_at").on(table.endsAt),
}));

// Webhook logs
export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  event: webhookEventEnum("event").notNull(),
  payload: text("payload").notNull(),
  
  url: text("url").notNull(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  
  success: boolean("success").default(false),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_webhook_logs_tenant").on(table.tenantId),
  successIdx: index("idx_webhook_logs_success").on(table.success),
}));

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  plans: many(plans),
  payments: many(payments),
  subscriptions: many(subscriptions),
  webhookLogs: many(webhookLogs),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [plans.tenantId],
    references: [tenants.id],
  }),
  payments: many(payments),
  subscriptions: many(subscriptions),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  plan: one(plans, {
    fields: [payments.planId],
    references: [plans.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.id],
    references: [subscriptions.paymentId],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [subscriptions.tenantId],
    references: [tenants.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
  payment: one(payments, {
    fields: [subscriptions.paymentId],
    references: [payments.id],
  }),
}));

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [webhookLogs.tenantId],
    references: [tenants.id],
  }),
}));

// Zod Schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  id: z.string().optional(),
});

export const insertPlanSchema = createInsertSchema(plans).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

// API Types for SDK
export type PaymentStatus = 'pending' | 'awaiting_confirmation' | 'confirmed' | 'expired' | 'failed' | 'cancelled';
export type Network = 'arbitrum' | 'ethereum' | 'tron';
export type Token = 'USDT' | 'USDC';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';
export type WebhookEvent = 'payment.created' | 'payment.confirmed' | 'payment.expired' | 'payment.failed' | 'subscription.activated' | 'subscription.expired';

// Network configuration types
export interface TokenConfig {
  address: string;
  decimals: number;
  name: string;
}

export interface NetworkConfig {
  id: Network;
  name: string;
  chainId?: number;
  tokens: Record<Token, TokenConfig>;
  minConfirmations: number;
  estimatedFee: string;
  confirmationTime: string;
  recommended: boolean;
  explorerUrl: string;
  explorerTxPath: string;
}

// OFAC Sanctioned Addresses
export const ofacSanctionedAddresses = pgTable("ofac_sanctioned_addresses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  address: varchar("address", { length: 256 }).notNull(),
  addressLower: varchar("address_lower", { length: 256 }).notNull(),
  addressType: varchar("address_type", { length: 50 }).notNull(),
  sdnName: text("sdn_name"),
  sdnId: varchar("sdn_id", { length: 50 }),
  source: varchar("source", { length: 50 }).notNull().default('OFAC_SDN'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
}, (table) => ({
  addressLowerIdx: index("idx_ofac_address_lower").on(table.addressLower),
  addressTypeIdx: index("idx_ofac_address_type").on(table.addressType),
}));

export const ofacUpdateLog = pgTable("ofac_update_log", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  totalAddresses: integer("total_addresses").notNull().default(0),
  newAddresses: integer("new_addresses").notNull().default(0),
  removedAddresses: integer("removed_addresses").notNull().default(0),
  sourceUrl: text("source_url"),
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOfacAddressSchema = createInsertSchema(ofacSanctionedAddresses).omit({
  id: true,
  createdAt: true,
});

export type OfacSanctionedAddress = typeof ofacSanctionedAddresses.$inferSelect;
export type InsertOfacAddress = z.infer<typeof insertOfacAddressSchema>;
export type OfacUpdateLog = typeof ofacUpdateLog.$inferSelect;

// Legacy users table (kept for compatibility)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
