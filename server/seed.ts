import { storage } from './storage';

export async function seedDatabase(): Promise<void> {
  console.log('[Seed] Checking if default tenant exists...');
  
  let tenant = await storage.getTenant('default');
  if (!tenant) {
    console.log('[Seed] Creating default tenant...');
    tenant = await storage.createTenant({
      id: 'default',
      name: 'Default Application',
      apiKey: 'local',
      apiKeyHash: 'local',
      webhookUrl: null,
      webhookSecret: null,
      paymentAddressEvm: process.env.PAYMENT_ADDRESS_EVM || null,
      paymentAddressTron: process.env.PAYMENT_ADDRESS_TRON || null,
      isActive: true,
    });
    console.log('[Seed] Default tenant created');
  }

  const existingPlans = await storage.getPlansByTenant('default');
  if (existingPlans.length > 0) {
    console.log('[Seed] Plans already exist, skipping...');
    return;
  }

  console.log('[Seed] Creating default plans...');

  try {
    await storage.createPlan({
      tenantId: 'default',
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
      tenantId: 'default',
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
      tenantId: 'default',
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
      tenantId: 'default',
      planKey: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for large teams',
      price: '499.99',
      currency: 'USDC',
      periodDays: 30,
      features: ['All Pro features', 'Dedicated support', 'SLA guarantee', 'Custom development', 'On-premise option'],
      isActive: true,
    });

    console.log('[Seed] Created 4 default plans');
    console.log('[Seed] Database seeding completed successfully');
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
  }
}
