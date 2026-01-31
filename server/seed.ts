import { storage } from './storage';
import { generateApiKey, hashApiKey, generateWebhookSecret } from './utils/encryption';

export async function seedDatabase(): Promise<void> {
  console.log('[Seed] Checking if seed data exists...');
  
  try {
    const plans = await storage.getPlansByTenant('demo-tenant');
    if (plans.length > 0) {
      console.log('[Seed] Seed data already exists, skipping...');
      return;
    }
  } catch (error) {
    console.log('[Seed] Creating seed data...');
  }

  const DEMO_API_KEY = 'demo_fc_crypto_payments_2024_public_key';
  const demoApiKeyHash = hashApiKey(DEMO_API_KEY);
  const demoWebhookSecret = 'demo_webhook_secret_for_testing';

  try {
    const demoTenant = await storage.createTenant({
      name: 'Demo Application',
      apiKey: DEMO_API_KEY.substring(0, 12) + '...',
      apiKeyHash: demoApiKeyHash,
      webhookUrl: null,
      webhookSecret: demoWebhookSecret,
      paymentAddressEvm: process.env.PAYMENT_ADDRESS_EVM || null,
      paymentAddressTron: process.env.PAYMENT_ADDRESS_TRON || null,
      isActive: true,
    });

    console.log('[Seed] Created demo tenant:', demoTenant.id);
    console.log('[Seed] Demo API Key:', DEMO_API_KEY);

    await storage.createPlan({
      tenantId: demoTenant.id,
      planKey: 'free',
      name: 'Free',
      description: 'Basic features for getting started',
      price: '0',
      currency: 'USDC',
      periodDays: null,
      features: ['Basic features', 'Community support'],
      isActive: true,
    });

    await storage.createPlan({
      tenantId: demoTenant.id,
      planKey: 'pro-monthly',
      name: 'Pro Monthly',
      description: 'All features with priority support',
      price: '19.99',
      currency: 'USDC',
      periodDays: 30,
      features: ['All features', 'Priority support', 'API access', 'Custom integrations'],
      isActive: true,
    });

    await storage.createPlan({
      tenantId: demoTenant.id,
      planKey: 'pro-yearly',
      name: 'Pro Yearly',
      description: 'Best value - 2 months free',
      price: '199.99',
      currency: 'USDC',
      periodDays: 365,
      features: ['All features', 'Priority support', 'API access', 'Custom integrations', '2 months free'],
      isActive: true,
    });

    await storage.createPlan({
      tenantId: demoTenant.id,
      planKey: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for large teams',
      price: '499.99',
      currency: 'USDC',
      periodDays: 30,
      features: ['All Pro features', 'Dedicated support', 'SLA guarantee', 'Custom development', 'On-premise option'],
      isActive: true,
    });

    console.log('[Seed] Created 4 demo plans');
    console.log('[Seed] Database seeding completed successfully');
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
  }
}
