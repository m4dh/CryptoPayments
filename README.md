# Crypto Payment Microservice

A standalone cryptocurrency payment microservice supporting USDT/USDC payments on Arbitrum, Ethereum, and Tron networks. Designed as an independent REST API with TypeScript SDK for easy integration.

## Features

- **Multi-Network Support**: Arbitrum (recommended), Ethereum, and Tron
- **Stablecoin Payments**: USDT and USDC on all supported networks
- **Multi-Tenant Architecture**: API key authentication with isolated tenant data
- **Blockchain Monitoring**: Real-time payment detection via Alchemy SDK (EVM) and TronGrid (Tron)
- **Webhook Notifications**: Secure HMAC-signed webhooks with automatic retries
- **TypeScript SDK**: Full-featured client library with type definitions
- **Encrypted Storage**: AES-256-GCM encryption for sensitive address data

## Supported Networks

| Network | Tokens | Est. Fee | Confirmation Time | Recommended |
|---------|--------|----------|-------------------|-------------|
| Arbitrum | USDT, USDC | ~$0.01 | ~1 minute | ✅ |
| Ethereum | USDT, USDC | ~$2-5 | ~5 minutes | |
| Tron | USDT, USDC | ~$0.50 | ~3 minutes | |

## Quick Start

### 1. Create a Tenant

```bash
curl -X POST https://your-service.app/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "My App"}'
```

Response:
```json
{
  "tenant": {"id": "...", "name": "My App"},
  "apiKey": "your-api-key",
  "webhookSecret": "your-webhook-secret",
  "message": "Store your API key securely - it will not be shown again"
}
```

### 2. Create a Plan

```bash
curl -X POST https://your-service.app/api/plans \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "planKey": "pro-monthly",
    "name": "Pro Monthly",
    "price": "19.99",
    "currency": "USDC",
    "periodDays": 30,
    "features": ["All features", "Priority support"]
  }'
```

### 3. Initiate a Payment

```bash
curl -X POST https://your-service.app/api/payments/initiate \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "externalUserId": "user-123",
    "planId": "plan-uuid",
    "network": "arbitrum",
    "token": "USDC",
    "senderAddress": "0x..."
  }'
```

Response:
```json
{
  "paymentId": "...",
  "receiverAddress": "0x...",
  "amount": "19.990000",
  "token": "USDC",
  "network": "arbitrum",
  "expiresAt": "2024-01-01T12:30:00.000Z",
  "expiresIn": 1799,
  "instructions": {...}
}
```

## TypeScript SDK

### Installation

```bash
npm install @crypto-payments/sdk
```

### Usage

```typescript
import { CryptoPaymentSDK, WebhookVerifier } from '@crypto-payments/sdk';

// Initialize SDK
const sdk = new CryptoPaymentSDK({
  apiKey: 'your-api-key',
  apiUrl: 'https://your-service.app',
});

// Get available networks
const networks = await sdk.payments.getNetworks();

// Initiate payment
const payment = await sdk.payments.initiate({
  externalUserId: 'user-123',
  planId: 'plan-uuid',
  network: 'arbitrum',
  token: 'USDC',
  senderAddress: '0x...',
});

// Confirm payment (after user sends transaction)
await sdk.payments.confirm(payment.paymentId);

// Check payment status
const status = await sdk.payments.getStatus(payment.paymentId);

// Get user subscription
const subscription = await sdk.subscriptions.getCurrent('user-123');
```

### Webhook Verification

```typescript
import { WebhookVerifier } from '@crypto-payments/sdk';
import express from 'express';

const app = express();
const verifier = new WebhookVerifier('your-webhook-secret');

// Register event handlers
verifier.on('payment.confirmed', (payload) => {
  console.log('Payment confirmed:', payload.data);
  // Activate user subscription
});

verifier.on('payment.failed', (payload) => {
  console.log('Payment failed:', payload.data);
  // Handle failure
});

verifier.on('subscription.created', (payload) => {
  console.log('Subscription created:', payload.data);
});

// Use as Express middleware
app.post('/webhooks', express.raw({ type: 'application/json' }), verifier.expressMiddleware());
```

## API Reference

### Authentication

All API requests (except tenant creation and health check) require an API key:

```
Authorization: Bearer your-api-key
```

### Endpoints

#### Tenant Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tenants` | Create new tenant (public) |
| GET | `/api/tenant` | Get tenant info |
| PATCH | `/api/tenant` | Update tenant (webhookUrl, payment addresses) |
| POST | `/api/tenant/regenerate-api-key` | Regenerate API key |
| POST | `/api/tenant/regenerate-webhook-secret` | Regenerate webhook secret |

#### Plans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plans` | List all plans |
| POST | `/api/plans` | Create new plan |
| PATCH | `/api/plans/:id` | Update plan |

#### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/networks` | Get supported networks |
| POST | `/api/payments/initiate` | Initiate new payment |
| POST | `/api/payments/:id/confirm` | Confirm payment sent |
| GET | `/api/payments/:id/status` | Get payment status |
| GET | `/api/payments/history` | Get payment history |
| DELETE | `/api/payments/:id` | Cancel pending payment |
| POST | `/api/payments/validate-address` | Validate wallet address |

#### Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscriptions/current` | Get current subscription |
| GET | `/api/subscriptions/history` | Get subscription history |
| GET | `/api/subscriptions/active` | Check if subscription active |

#### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (public) |

## Webhook Events

The service sends webhook notifications for payment events:

| Event | Description |
|-------|-------------|
| `payment.pending` | Payment initiated, awaiting blockchain transaction |
| `payment.awaiting_confirmation` | Transaction detected, awaiting confirmations |
| `payment.confirmed` | Payment confirmed on blockchain |
| `payment.failed` | Payment failed or expired |
| `subscription.created` | New subscription activated |
| `subscription.renewed` | Subscription renewed |
| `subscription.expired` | Subscription expired |

### Webhook Payload

```json
{
  "event": "payment.confirmed",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "paymentId": "...",
    "externalUserId": "user-123",
    "amount": "19.990000",
    "token": "USDC",
    "network": "arbitrum",
    "txHash": "0x...",
    "planId": "...",
    "subscriptionId": "..."
  }
}
```

### Webhook Signature

Webhooks are signed using HMAC-SHA256. Verify using the `X-Webhook-Signature` header:

```typescript
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');

const isValid = signature === req.headers['x-webhook-signature'];
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SESSION_SECRET` | Secret for encryption key derivation | Yes |
| `ALCHEMY_API_KEY` | Alchemy API key for EVM monitoring | Yes |
| `PAYMENT_ADDRESS_EVM` | Default EVM payment receiver address | Yes |
| `PAYMENT_ADDRESS_TRON` | Default Tron payment receiver address | Yes |

## Payment Flow

1. **Initiate**: Client calls `/api/payments/initiate` with user ID, plan, network, token, and sender address
2. **Display**: Show receiver address and amount to user
3. **User Sends**: User sends exact amount from their wallet
4. **Confirm**: Client calls `/api/payments/:id/confirm` to start blockchain monitoring
5. **Monitor**: Service monitors blockchain for incoming transaction
6. **Webhook**: On confirmation, webhook is sent to tenant's webhook URL
7. **Subscription**: Subscription is automatically created/renewed

## Security

- **API Keys**: Hashed with SHA-256 for secure lookup
- **Sender Addresses**: Encrypted with AES-256-GCM
- **Webhook Signatures**: HMAC-SHA256 with timing-safe comparison
- **Rate Limiting**: Tiered limits (strict: 10/min, standard: 100/min, polling: 120/min)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Push database schema
npm run db:push
```

## License

MIT

---

Built by [Future and Code](https://futureandcode.com)
