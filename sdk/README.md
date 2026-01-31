# Crypto Payment SDK

TypeScript SDK for integrating with the Crypto Payment Service. Supports USDT/USDC payments on Arbitrum, Ethereum, and Tron networks.

## Installation

```bash
npm install @crypto-payments/sdk
```

## Quick Start

```typescript
import { CryptoPaymentSDK } from '@crypto-payments/sdk';

const sdk = new CryptoPaymentSDK({
  apiKey: 'your-api-key',
  apiUrl: 'https://your-payment-service.app',
});

// Initiate a payment
const payment = await sdk.payments.initiate({
  externalUserId: 'user-123',
  planId: 'pro-monthly',
  network: 'arbitrum',
  token: 'USDC',
  senderAddress: '0x...',
});

console.log('Payment ID:', payment.paymentId);
console.log('Send', payment.amount, payment.token, 'to:', payment.receiverAddress);
```

## API Reference

### Initialization

```typescript
const sdk = new CryptoPaymentSDK({
  apiKey: string;        // Your API key
  apiUrl: string;        // Payment service URL
  webhookSecret?: string; // For webhook verification
  timeout?: number;       // Request timeout in ms (default: 30000)
});
```

### Payments

```typescript
// Get available networks
const networks = await sdk.payments.getNetworks();

// Get available plans
const plans = await sdk.payments.getPlans();

// Initiate payment
const payment = await sdk.payments.initiate({
  externalUserId: 'user-123',
  planId: 'plan-id',
  network: 'arbitrum', // 'arbitrum' | 'ethereum' | 'tron'
  token: 'USDC',       // 'USDT' | 'USDC'
  senderAddress: '0x...',
});

// Confirm payment (after user sends transaction)
await sdk.payments.confirm(payment.paymentId);

// Check payment status
const status = await sdk.payments.getStatus(payment.paymentId);

// Get payment history
const history = await sdk.payments.getHistory('user-123');

// Cancel pending payment
await sdk.payments.cancel(payment.paymentId);

// Validate address
const validation = await sdk.payments.validateAddress('0x...', 'arbitrum');
```

### Subscriptions

```typescript
// Get current subscription
const subscription = await sdk.subscriptions.getCurrent('user-123');

// Check if subscription is active
const isActive = await sdk.subscriptions.isActive('user-123');

// Get subscription history
const history = await sdk.subscriptions.getHistory('user-123');
```

### Plans Management

```typescript
// List plans
const plans = await sdk.plans.list();

// Create plan
const plan = await sdk.plans.create({
  planKey: 'pro-monthly',
  name: 'Pro Monthly',
  price: '19.99',
  currency: 'USDC',
  periodDays: 30,
  features: ['feature1', 'feature2'],
});

// Update plan
await sdk.plans.update(plan.id, { price: '24.99' });
```

### Tenant Management

```typescript
// Get tenant info
const tenant = await sdk.tenant.getInfo();

// Update tenant settings
await sdk.tenant.update({
  webhookUrl: 'https://your-app.com/webhooks',
});

// Regenerate API key
const { apiKey } = await sdk.tenant.regenerateApiKey();

// Regenerate webhook secret
const { webhookSecret } = await sdk.tenant.regenerateWebhookSecret();
```

## Webhook Handling

```typescript
import { WebhookVerifier } from '@crypto-payments/sdk';

const verifier = new WebhookVerifier('your-webhook-secret');

// Register event handlers
verifier.on('payment.confirmed', (payload) => {
  console.log('Payment confirmed:', payload.data.paymentId);
});

verifier.on('subscription.activated', (payload) => {
  console.log('Subscription activated for user:', payload.data.externalUserId);
});

// Use with Express
app.post('/webhooks', express.raw({ type: 'application/json' }), verifier.expressMiddleware());
```

### Webhook Events

| Event | Description |
|-------|-------------|
| `payment.created` | Payment initiated |
| `payment.confirmed` | Payment verified on blockchain |
| `payment.expired` | Payment timeout (30 min) |
| `payment.failed` | Payment verification failed |
| `subscription.activated` | Subscription started |
| `subscription.expired` | Subscription ended |

## Error Handling

```typescript
import { CryptoPaymentError } from '@crypto-payments/sdk';

try {
  await sdk.payments.initiate({...});
} catch (error) {
  if (error instanceof CryptoPaymentError) {
    console.log('Error code:', error.code);
    console.log('HTTP status:', error.statusCode);
    console.log('Message:', error.message);
  }
}
```

## Types

All TypeScript types are exported:

```typescript
import type {
  PaymentStatus,
  Network,
  Token,
  InitiatePaymentParams,
  PaymentStatusResult,
  SubscriptionInfo,
  // ... and more
} from '@crypto-payments/sdk';
```

## License

MIT
