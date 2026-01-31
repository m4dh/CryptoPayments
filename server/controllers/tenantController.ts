import { Request, Response } from 'express';
import { z } from 'zod';
import { tenantService } from '../services/tenantService';
import type { Token } from '@shared/schema';

const createTenantSchema = z.object({
  name: z.string().min(1),
  webhookUrl: z.string().url().optional(),
  paymentAddressEvm: z.string().optional(),
  paymentAddressTron: z.string().optional(),
});

const createPlanSchema = z.object({
  planKey: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.string(),
  currency: z.enum(['USDT', 'USDC']).optional(),
  periodDays: z.number().int().positive().optional(),
  features: z.array(z.string()).optional(),
});

const updatePlanSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  price: z.string().optional(),
  periodDays: z.number().int().positive().optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function getAllTenants(req: Request, res: Response) {
  try {
    const tenants = await tenantService.getAllTenants();
    res.json({ 
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        apiKey: t.apiKey,
        webhookUrl: t.webhookUrl,
        isActive: t.isActive,
        createdAt: t.createdAt,
      }))
    });
  } catch (error) {
    console.error('[TenantController] Error getting tenants:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get tenants' });
  }
}

export async function createTenant(req: Request, res: Response) {
  try {
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const result = await tenantService.createTenant(parsed.data);
    
    res.status(201).json({
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        webhookUrl: result.tenant.webhookUrl,
        createdAt: result.tenant.createdAt,
      },
      apiKey: result.apiKey,
      webhookSecret: result.webhookSecret,
      message: 'Store your API key securely - it will not be shown again',
    });
  } catch (error) {
    console.error('[TenantController] Error creating tenant:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create tenant' });
  }
}

export async function getTenantInfo(req: Request, res: Response) {
  try {
    const tenant = req.tenant!;
    res.json({
      id: tenant.id,
      name: tenant.name,
      webhookUrl: tenant.webhookUrl,
      paymentAddressEvm: tenant.paymentAddressEvm,
      paymentAddressTron: tenant.paymentAddressTron,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
    });
  } catch (error) {
    console.error('[TenantController] Error getting tenant info:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get tenant info' });
  }
}

export async function updateTenantInfo(req: Request, res: Response) {
  try {
    const { webhookUrl, paymentAddressEvm, paymentAddressTron } = req.body;
    
    const updated = await tenantService.updateTenant(req.tenant!.id, {
      webhookUrl,
      paymentAddressEvm,
      paymentAddressTron,
    });

    if (!updated) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant not found' });
    }

    res.json({
      id: updated.id,
      name: updated.name,
      webhookUrl: updated.webhookUrl,
      paymentAddressEvm: updated.paymentAddressEvm,
      paymentAddressTron: updated.paymentAddressTron,
    });
  } catch (error) {
    console.error('[TenantController] Error updating tenant:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update tenant' });
  }
}

export async function regenerateApiKey(req: Request, res: Response) {
  try {
    const result = await tenantService.regenerateApiKey(req.tenant!.id);
    if (!result) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant not found' });
    }
    res.json({
      apiKey: result.apiKey,
      message: 'Store your new API key securely - the old key is now invalid',
    });
  } catch (error) {
    console.error('[TenantController] Error regenerating API key:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to regenerate API key' });
  }
}

export async function regenerateWebhookSecret(req: Request, res: Response) {
  try {
    const result = await tenantService.regenerateWebhookSecret(req.tenant!.id);
    if (!result) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant not found' });
    }
    res.json({
      webhookSecret: result.webhookSecret,
      message: 'Update your webhook verification to use the new secret',
    });
  } catch (error) {
    console.error('[TenantController] Error regenerating webhook secret:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to regenerate webhook secret' });
  }
}

export async function createPlan(req: Request, res: Response) {
  try {
    const parsed = createPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const plan = await tenantService.createPlan(req.tenant!.id, {
      planKey: parsed.data.planKey,
      name: parsed.data.name,
      description: parsed.data.description || null,
      price: parsed.data.price,
      currency: (parsed.data.currency as Token) || 'USDC',
      periodDays: parsed.data.periodDays || null,
      features: parsed.data.features || null,
      isActive: true,
    });

    res.status(201).json(plan);
  } catch (error) {
    console.error('[TenantController] Error creating plan:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create plan' });
  }
}

export async function getPlans(req: Request, res: Response) {
  try {
    const plans = await tenantService.getPlans(req.tenant!.id);
    res.json({ plans });
  } catch (error) {
    console.error('[TenantController] Error getting plans:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get plans' });
  }
}

export async function updatePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parsed = updatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const updated = await tenantService.updatePlan(id, req.tenant!.id, parsed.data);
    if (!updated) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Plan not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[TenantController] Error updating plan:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update plan' });
  }
}
