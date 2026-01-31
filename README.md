# Crypto Payment Library

A native cryptocurrency payment library for USDT/USDC payments on Arbitrum, Ethereum, and Tron networks. Designed for direct integration into your application without external API calls or authentication.

## Features

- **Multi-Network Support**: Arbitrum (recommended), Ethereum, and Tron
- **Stablecoin Payments**: USDT and USDC on all supported networks
- **Native Library**: Import and use directly - no API keys required
- **Blockchain Monitoring**: Real-time payment detection via Alchemy SDK (EVM) and TronGrid (Tron)
- **Webhook Notifications**: Optional HMAC-signed webhooks with automatic retries
- **Encrypted Storage**: AES-256-GCM encryption for sensitive address data
- **Demo UI**: Built-in payment flow for testing

## Supported Networks

| Network | Tokens | Est. Fee | Confirmation Time | Recommended |
|---------|--------|----------|-------------------|-------------|
| Arbitrum | USDT, USDC | ~$0.01 | ~1 minute | Yes |
| Ethereum | USDT, USDC | ~$2-5 | ~5 minutes | |
| Tron | USDT, USDC | ~$0.50 | ~3 minutes | |

## Quick Start

### 1. Configure Environment Variables

```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=your-secret-key
ALCHEMY_API_KEY=your-alchemy-key
PAYMENT_ADDRESS_EVM=0x...
PAYMENT_ADDRESS_TRON=T...
```

### 2. Import and Configure

```typescript
import { cryptoPayments } from './lib/cryptoPayments';

// Optional: Override payment addresses
cryptoPayments.configure({
  paymentAddressEvm: '0x...',
  paymentAddressTron: 'T...',
});
```

### 3. Create a Plan

```typescript
await cryptoPayments.createPlan({
  planKey: 'pro-monthly',
  name: 'Pro Monthly',
  price: '19.99',
  currency: 'USDC',
  periodDays: 30,
  features: ['All features', 'Priority support'],
});
```

### 4. Initiate a Payment

```typescript
const payment = await cryptoPayments.initiatePayment({
  userId: 'user-123',
  planId: 'plan-uuid',
  network: 'arbitrum',
  token: 'USDC',
  senderAddress: '0x...',
});

console.log('Send payment to:', payment.receiverAddress);
console.log('Amount:', payment.amount, payment.token);
console.log('Expires in:', payment.expiresIn, 'seconds');
```

### 5. Confirm Payment Sent

```typescript
// After user sends transaction
await cryptoPayments.confirmPaymentSent(payment.paymentId);
```

### 6. Check Payment Status

```typescript
const status = await cryptoPayments.getPaymentStatus(payment.paymentId);
console.log('Status:', status.status); // pending, awaiting_confirmation, confirmed, expired
```

## Library API

### Configuration

```typescript
cryptoPayments.configure({
  paymentAddressEvm?: string,    // EVM receiving address
  paymentAddressTron?: string,   // Tron receiving address
  webhookUrl?: string,           // Webhook notification URL
  webhookSecret?: string,        // Webhook HMAC secret
});
```

### Plans

```typescript
// Get all plans
const plans = await cryptoPayments.getPlans();

// Create a plan
await cryptoPayments.createPlan({
  planKey: string,
  name: string,
  description?: string,
  price: string,
  currency?: 'USDT' | 'USDC',
  periodDays?: number,
  features?: string[],
});
```

### Networks

```typescript
// Get supported networks
const networks = cryptoPayments.getNetworks();

// Get specific network info
const arbitrum = cryptoPayments.getNetwork('arbitrum');
```

### Payments

```typescript
// Initiate payment
const payment = await cryptoPayments.initiatePayment({
  userId: string,
  planId: string,
  network: 'arbitrum' | 'ethereum' | 'tron',
  token: 'USDT' | 'USDC',
  senderAddress: string,
});

// Confirm payment sent
await cryptoPayments.confirmPaymentSent(paymentId);

// Get payment status
const status = await cryptoPayments.getPaymentStatus(paymentId);
```

### Subscriptions

```typescript
// Get current user subscription
const subscription = await cryptoPayments.getCurrentSubscription(userId);

// Get subscription history
const history = await cryptoPayments.getSubscriptionHistory(userId);
```

## REST API Endpoints

For applications that prefer REST API integration:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plans` | List available plans |
| GET | `/api/networks` | Get supported networks |
| POST | `/api/payments` | Initiate new payment |
| POST | `/api/payments/:id/confirm` | Confirm payment sent |
| GET | `/api/payments/:id/status` | Get payment status |
| GET | `/api/health` | Health check |

### Example: Initiate Payment via REST

```bash
curl -X POST http://localhost:5000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "planId": "plan-uuid",
    "network": "arbitrum",
    "token": "USDC",
    "senderAddress": "0x..."
  }'
```

## Webhook Events

Optional webhook notifications for payment events:

| Event | Description |
|-------|-------------|
| `payment.pending` | Payment initiated |
| `payment.awaiting_confirmation` | Transaction detected |
| `payment.confirmed` | Payment confirmed on blockchain |
| `payment.expired` | Payment timeout (30 minutes) |
| `subscription.activated` | Subscription created/renewed |

### Webhook Payload

```json
{
  "event": "payment.confirmed",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "paymentId": "...",
    "userId": "user-123",
    "amount": "19.99",
    "token": "USDC",
    "network": "arbitrum",
    "txHash": "0x..."
  }
}
```

### Webhook Signature Verification

```typescript
import crypto from 'crypto';

const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');

const isValid = signature === req.headers['x-webhook-signature'];
```

## Payment Flow

1. **Initiate**: Call `cryptoPayments.initiatePayment()` with user and plan details
2. **Display**: Show QR code with receiver address and amount to user
3. **User Sends**: User sends exact amount from their wallet
4. **Confirm**: Call `cryptoPayments.confirmPaymentSent()` to start monitoring
5. **Monitor**: Library monitors blockchain for incoming transaction
6. **Complete**: Payment confirmed, subscription activated
7. **Webhook**: Optional notification sent to configured URL

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SESSION_SECRET` | Secret for encryption key derivation | Yes |
| `ALCHEMY_API_KEY` | Alchemy API key for EVM monitoring | Yes |
| `PAYMENT_ADDRESS_EVM` | Default EVM payment receiver address | Yes |
| `PAYMENT_ADDRESS_TRON` | Default Tron payment receiver address | Yes |
| `TRONGRID_API_KEY` | TronGrid API key (optional) | No |

## Security

- **Sender Addresses**: Encrypted with AES-256-GCM
- **Address Matching**: HMAC-SHA256 for secure lookup
- **Webhook Signatures**: HMAC-SHA256 with timing-safe comparison
- **Payment Timeout**: 30 minutes to prevent stale payments

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Push database schema
npm run db:push
```

## Demo UI

Visit `/pay` to test the payment flow with the built-in demo interface.

## License

MIT

---

Built by [Future and Code](https://futureandcode.com)
