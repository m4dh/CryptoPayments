import { storage } from "../storage";
import { generateApiKey, hashApiKey, generateWebhookSecret } from "../utils/encryption";
import type { Tenant, InsertTenant, Plan, InsertPlan } from "@shared/schema";

export interface CreateTenantParams {
  name: string;
  webhookUrl?: string;
  paymentAddressEvm?: string;
  paymentAddressTron?: string;
}

export interface CreateTenantResult {
  tenant: Tenant;
  apiKey: string;
  webhookSecret: string;
}

class TenantService {
  async createTenant(params: CreateTenantParams): Promise<CreateTenantResult> {
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const webhookSecret = generateWebhookSecret();

    const tenant = await storage.createTenant({
      name: params.name,
      apiKey: apiKey.substring(0, 8) + '...',
      apiKeyHash,
      webhookUrl: params.webhookUrl || null,
      webhookSecret,
      paymentAddressEvm: params.paymentAddressEvm || null,
      paymentAddressTron: params.paymentAddressTron || null,
      isActive: true,
    });

    return {
      tenant,
      apiKey,
      webhookSecret,
    };
  }

  async getTenantByApiKey(apiKey: string): Promise<Tenant | undefined> {
    const apiKeyHash = hashApiKey(apiKey);
    return storage.getTenantByApiKeyHash(apiKeyHash);
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    return storage.getTenant(id);
  }

  async getAllTenants(): Promise<Tenant[]> {
    return storage.getAllTenants();
  }

  async updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant | undefined> {
    return storage.updateTenant(id, data);
  }

  async deleteTenant(id: string): Promise<boolean> {
    return storage.deleteTenant(id);
  }

  async regenerateApiKey(tenantId: string): Promise<{ apiKey: string } | null> {
    const tenant = await storage.getTenant(tenantId);
    if (!tenant) return null;

    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    await storage.updateTenant(tenantId, {
      apiKey: apiKey.substring(0, 8) + '...',
      apiKeyHash,
    });

    return { apiKey };
  }

  async regenerateWebhookSecret(tenantId: string): Promise<{ webhookSecret: string } | null> {
    const tenant = await storage.getTenant(tenantId);
    if (!tenant) return null;

    const webhookSecret = generateWebhookSecret();
    await storage.updateTenant(tenantId, { webhookSecret });

    return { webhookSecret };
  }

  async createPlan(tenantId: string, planData: Omit<InsertPlan, 'tenantId'>): Promise<Plan> {
    return storage.createPlan({
      ...planData,
      tenantId,
    });
  }

  async getPlans(tenantId: string): Promise<Plan[]> {
    return storage.getPlansByTenant(tenantId);
  }

  async updatePlan(planId: string, tenantId: string, data: Partial<Plan>): Promise<Plan | undefined> {
    const plan = await storage.getPlan(planId);
    if (!plan || plan.tenantId !== tenantId) {
      return undefined;
    }
    return storage.updatePlan(planId, data);
  }

  async getDemoCredentials(): Promise<{ apiKey: string; tenantId: string } | null> {
    const DEMO_API_KEY = 'demo_fc_crypto_payments_2024_public_key';
    const tenant = await this.getTenantByApiKey(DEMO_API_KEY);
    if (!tenant) return null;
    return {
      apiKey: DEMO_API_KEY,
      tenantId: tenant.id,
    };
  }
}

export const tenantService = new TenantService();
