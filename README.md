# Crypto Payment Library

A native cryptocurrency payment library for USDT/USDC payments on Arbitrum, Ethereum, and Tron networks. Designed for direct integration into your application — no external API calls, no authentication keys required. The system includes real-time blockchain monitoring, encrypted address storage, webhook notifications, and OFAC (Office of Foreign Assets Control) sanctions compliance verification that blocks transactions from sanctioned addresses.

---

## Table of Contents

1. [Key Features](#key-features)
2. [Supported Networks](#supported-networks)
3. [System Architecture](#system-architecture)
4. [Quick Start](#quick-start)
5. [Library API (Native)](#library-api-native)
6. [REST API](#rest-api)
7. [OFAC Compliance System](#ofac-compliance-system)
8. [Webhook System](#webhook-system)
9. [Blockchain Monitoring](#blockchain-monitoring)
10. [Scheduled Jobs](#scheduled-jobs)
11. [Security & Encryption](#security--encryption)
12. [Database Schema](#database-schema)
13. [Environment Variables](#environment-variables)
14. [Project Structure](#project-structure)
15. [Frontend — Demo UI](#frontend--demo-ui)
16. [Development & Testing](#development--testing)

---

## Key Features

- **Multi-Network Payments**: Arbitrum (recommended), Ethereum, Tron
- **Stablecoin Support**: USDT and USDC on all supported networks
- **Native Library**: Import and use directly — no API keys required
- **Blockchain Monitoring**: Real-time transaction detection via Alchemy SDK (EVM) and TronGrid (Tron)
- **OFAC Compliance**: Automatic sender address verification against the US Treasury SDN sanctions list
- **Webhooks**: Optional HMAC-SHA256 signed notifications with automatic retries
- **Encryption**: AES-256-GCM for sensitive address data
- **Demo UI**: Built-in payment interface for testing
- **Subscription Plans**: Plan management with automatic subscription activation upon confirmed payment
- **QR Code**: Wallet address QR code generation for easy payment

---

## Supported Networks

| Network | Tokens | Chain ID | Est. Fee | Confirmation Time | Min. Confirmations | Recommended |
|---------|--------|----------|----------|--------------------|--------------------|-------------|
| Arbitrum One | USDT, USDC | 42161 | ~$0.01 | ~1 minute | 3 | Yes |
| Ethereum | USDT, USDC | 1 | ~$2-5 | ~5 minutes | 12 | No |
| Tron | USDT, USDC | — | ~$0.50 | ~3 minutes | 20 | No |

### Token Contract Addresses

**Arbitrum:**
- USDT: `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` (6 decimals)
- USDC: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (6 decimals)

**Ethereum:**
- USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7` (6 decimals)
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` (6 decimals)

**Tron:**
- USDT: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (6 decimals)
- USDC: `TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8` (6 decimals)

---

## System Architecture

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Wouter (routing)
- TanStack React Query (server state management)
- shadcn/ui + Radix UI (UI components)
- Tailwind CSS (styling)
- Vite (build tool)
- qrcode.react (QR generation)

**Backend:**
- Express.js with TypeScript
- Drizzle ORM with PostgreSQL
- Alchemy SDK (EVM monitoring)
- TronGrid API (Tron monitoring)
- node-cron (scheduled jobs)
- fast-xml-parser (OFAC XML parsing)
- Zod (data validation)

### Payment Flow Diagram

```
User                Library                 Blockchain          OFAC
  |                    |                        |                |
  |-- Initiate ------->|                        |                |
  |                    |-- OFAC Check --------->|                |
  |                    |<-- Clean / Sanctioned--|                |
  |                    |                        |                |
  |<-- Address + QR ---|                        |                |
  |                    |                        |                |
  |-- Send TX -------->|                        |                |
  |                    |                        |                |
  |-- Confirm -------->|                        |                |
  |                    |-- Monitor ------------>|                |
  |                    |<-- TX Found -----------|                |
  |                    |                        |                |
  |<-- Confirmed ------|                        |                |
  |                    |-- Webhook ------------>|                |
```

---

## Quick Start

### 1. Configure Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SESSION_SECRET=your-secret-key-minimum-32-characters
ALCHEMY_API_KEY=your-alchemy-api-key
PAYMENT_ADDRESS_EVM=0x...your-evm-address
PAYMENT_ADDRESS_TRON=T...your-tron-address
```

### 2. Import and Configure

```typescript
import { cryptoPayments } from './lib/cryptoPayments';

// Optional: override payment addresses
cryptoPayments.configure({
  paymentAddressEvm: '0x...',
  paymentAddressTron: 'T...',
  webhookUrl: 'https://your-domain.com/webhook',
  webhookSecret: 'your-webhook-secret-key',
});
```

### 3. Create a Subscription Plan

```typescript
await cryptoPayments.createPlan({
  planKey: 'pro-monthly',
  name: 'Pro Monthly',
  description: 'Full platform access',
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
  senderAddress: '0x...sender-address',
});

// If the address is on the OFAC sanctions list, an error is thrown:
// "OFAC_SANCTIONED: Address ... is on the OFAC SDN sanctions list"

console.log('Send payment to:', payment.receiverAddress);
console.log('Amount:', payment.amount, payment.token);
console.log('Expires in:', payment.expiresIn, 'seconds');
```

### 5. Confirm Payment Sent

```typescript
// After the user sends the transaction
await cryptoPayments.confirmPaymentSent(payment.paymentId);
// The system automatically monitors the blockchain and confirms the transaction
```

### 6. Check Payment Status

```typescript
const status = await cryptoPayments.getPaymentStatus(payment.paymentId);
console.log('Status:', status.status);
// pending -> awaiting_confirmation -> confirmed / expired / failed
```

---

## Library API (Native)

### Configuration

```typescript
cryptoPayments.configure({
  paymentAddressEvm?: string,    // EVM receiving address
  paymentAddressTron?: string,   // Tron receiving address
  webhookUrl?: string,           // Webhook notification URL
  webhookSecret?: string,        // Webhook HMAC secret key
});
```

### Subscription Plans

```typescript
// Get all plans
const plans = await cryptoPayments.getPlans();

// Get plan by ID
const plan = await cryptoPayments.getPlan('plan-uuid');

// Get plan by key
const plan = await cryptoPayments.getPlanByKey('pro-monthly');

// Create a plan
const newPlan = await cryptoPayments.createPlan({
  planKey: string,          // Unique plan identifier
  name: string,             // Display name
  description?: string,     // Plan description
  price: string,            // Price (e.g. '19.99')
  currency?: 'USDT' | 'USDC',  // Currency (defaults to USDC)
  periodDays?: number,      // Subscription period in days
  features?: string[],      // List of plan features
});
```

### Networks

```typescript
// Get all supported networks
const networks = cryptoPayments.getNetworks();
// Returns: { id, name, chainId, tokens, estimatedFee, confirmationTime, recommended }[]

// Get specific network info
const arbitrum = cryptoPayments.getNetwork('arbitrum');
```

### Payments

```typescript
// Initiate a payment (includes automatic OFAC check)
const payment = await cryptoPayments.initiatePayment({
  userId: string,                              // User ID in your application
  planId: string,                              // Plan UUID
  network: 'arbitrum' | 'ethereum' | 'tron',   // Blockchain network
  token: 'USDT' | 'USDC',                     // Payment token
  senderAddress: string,                        // Sender wallet address
});
// Returns: { paymentId, amount, token, network, receiverAddress, expiresAt, expiresIn }
// Throws if OFAC sanctioned: Error('OFAC_SANCTIONED: ...')

// Confirm payment was sent (starts blockchain monitoring)
const status = await cryptoPayments.confirmPaymentSent(paymentId);

// Check payment status
const status = await cryptoPayments.getPaymentStatus(paymentId);
// Returns: { paymentId, status, amount, token, network, txHash, confirmedAt }

// Get user's payment history
const history = await cryptoPayments.getPaymentHistory(userId, limit?);

// Cancel a payment (only in pending/awaiting_confirmation status)
await cryptoPayments.cancelPayment(paymentId);
```

### Subscriptions

```typescript
// Get user's active subscription
const subscription = await cryptoPayments.getCurrentSubscription(userId);
// Returns: { id, planId, status, startsAt, endsAt } | null

// Get subscription history
const history = await cryptoPayments.getSubscriptionHistory(userId);
```

### Address Validation

```typescript
// Validate a blockchain address
const result = cryptoPayments.validateAddress(address, network);
// Returns: { valid: boolean, error?: string }
```

---

## REST API

For applications that prefer REST API integration:

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System health check |
| GET | `/api/networks` | List supported networks |
| GET | `/api/plans` | List available plans |
| POST | `/api/plans` | Create a new plan |
| POST | `/api/payments` | Initiate a new payment |
| POST | `/api/payments/:id/confirm` | Confirm payment was sent |
| GET | `/api/payments/:id/status` | Check payment status |
| GET | `/api/payments/history/:userId` | User's payment history |
| DELETE | `/api/payments/:id` | Cancel a payment |
| POST | `/api/validate-address` | Validate a blockchain address |
| GET | `/api/subscriptions/:userId` | User's active subscription |
| GET | `/api/subscriptions/:userId/history` | Subscription history |

### OFAC Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ofac/status` | OFAC system status |
| GET | `/api/ofac/check/:address` | Check address against sanctions list |
| POST | `/api/ofac/update` | Force OFAC list update |

### REST API Examples

#### Initiate a Payment

```bash
curl -X POST http://localhost:5000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "planId": "plan-uuid",
    "network": "arbitrum",
    "token": "USDC",
    "senderAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
  }'
```

Success response:
```json
{
  "paymentId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "amount": "19.990000",
  "token": "USDC",
  "network": "arbitrum",
  "receiverAddress": "0x...",
  "expiresAt": "2025-01-01T12:30:00.000Z",
  "expiresIn": 1800
}
```

Sanctioned address response:
```json
{
  "error": "OFAC_SANCTIONED: Address 0x... is on the OFAC SDN sanctions list (EXAMPLE ENTITY NAME). Transaction blocked for compliance."
}
```

#### Check an Address Against OFAC

```bash
curl http://localhost:5000/api/ofac/check/0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18
```

Clean address response:
```json
{
  "isSanctioned": false,
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  "matchedEntries": [],
  "checkedAt": "2025-01-01T12:00:00.000Z"
}
```

Sanctioned address response:
```json
{
  "isSanctioned": true,
  "address": "0x...",
  "matchedEntries": [
    {
      "sdnName": "TORNADO CASH",
      "sdnId": "36720",
      "addressType": "ethereum",
      "source": "OFAC_SDN"
    }
  ],
  "checkedAt": "2025-01-01T12:00:00.000Z"
}
```

#### OFAC System Status

```bash
curl http://localhost:5000/api/ofac/status
```

Response:
```json
{
  "lastUpdate": "2025-01-01T00:00:00.000Z",
  "totalAddresses": 1247,
  "lastUpdateSuccess": true,
  "addressTypes": {
    "ethereum": 820,
    "bitcoin": 315,
    "tron": 89,
    "litecoin": 23
  }
}
```

#### Force OFAC List Update

```bash
curl -X POST http://localhost:5000/api/ofac/update
```

Response:
```json
{
  "success": true,
  "totalAddresses": 1247,
  "newAddresses": 12,
  "removedAddresses": 3
}
```

---

## OFAC Compliance System

### Overview

The OFAC (Office of Foreign Assets Control) system ensures compliance with US Treasury Department sanctions regulations. It automatically downloads and parses the official SDN (Specially Designated Nationals and Blocked Persons) list in XML format directly from the US government website.

### Data Source

- **URL**: `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.XML`
- **Format**: XML (SDN_ADVANCED.XML) — approximately 116 MB
- **Parser**: `fast-xml-parser` with regex fallback for alternative formats

### Supported Digital Currency Address Types

The system recognizes and extracts cryptocurrency addresses labeled as "Digital Currency Address" of the following types:

| XML Ticker | Network Type |
|------------|-------------|
| XBT | Bitcoin |
| ETH | Ethereum |
| TRX | Tron |
| XRP | Ripple |
| LTC | Litecoin |
| BCH | Bitcoin Cash |
| DASH | Dash |
| XMR | Monero |
| XVG | Verge |
| USDT | Tether |
| USDC | USD Coin |
| ARB | Arbitrum |
| BSC | BSC |
| ERC20 | Ethereum (ERC-20) |
| TRC20 | Tron (TRC-20) |

### OFAC Verification Flow

1. **On server startup**: If the database is empty, automatically downloads and loads the full SDN_ADVANCED.XML file
2. **Daily at midnight UTC**: A scheduled cron job automatically updates the sanctions list
3. **On every payment**: The sender address is checked against the sanctioned addresses database before payment initiation
4. **On demand via API**: The `GET /api/ofac/check/:address` endpoint allows checking any address
5. **Manual update**: The `POST /api/ofac/update` endpoint forces an immediate update

### Integration with Payment Flow

OFAC verification is built directly into the `cryptoPayments.initiatePayment()` method. The flow:

1. Address format validation (EVM or Tron)
2. **OFAC check** — compare address against the sanctioned addresses database
3. If the address is on the list → throw `OFAC_SANCTIONED` error with the sanctioned entity name
4. If the address is clean → continue with payment creation

### Frontend — Real-Time OFAC Indicator

The payment interface displays OFAC check status in real time:

- **Idle**: No display (address too short or not entered)
- **Checking**: Animated loading spinner (500ms debounce after last keystroke)
- **Clean**: Green shield icon with "OFAC compliance check passed" text
- **Sanctioned**: Red shield icon with full warning message and disabled "Continue" button

### OFAC Database Tables

**ofac_sanctioned_addresses:**

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) | UUID primary key |
| address | VARCHAR(256) | Original blockchain address |
| address_lower | VARCHAR(256) | Normalized address (lowercase) — indexed |
| address_type | VARCHAR(50) | Network type (ethereum, bitcoin, tron, etc.) |
| sdn_name | TEXT | SDN entity name |
| sdn_id | VARCHAR(50) | OFAC entity ID |
| source | VARCHAR(50) | Data source (default 'OFAC_SDN') |
| created_at | TIMESTAMP | Date added to database |
| last_seen_at | TIMESTAMP | Last confirmed on the list |

**ofac_update_log:**

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) | UUID primary key |
| total_addresses | INTEGER | Total addresses after update |
| new_addresses | INTEGER | New addresses added |
| removed_addresses | INTEGER | Addresses removed |
| source_url | TEXT | Data source URL |
| success | BOOLEAN | Whether update succeeded |
| error_message | TEXT | Error message (if any) |
| created_at | TIMESTAMP | Update timestamp |

### XML Parsing

The system uses a two-stage parsing approach:

1. **Structural parsing** (fast-xml-parser): Analyzes the XML structure, looking for `sdnEntry` entries, their `idList` and `features` containing digital currency addresses
2. **Regex parsing (fallback)**: If structural parsing finds no addresses, regular expressions are used to detect addresses in these formats:
   - EVM: `0x[a-fA-F0-9]{40}`
   - Tron: `T[a-zA-Z0-9]{33}`
   - Bitcoin: `[13][a-km-zA-HJ-NP-Z1-9]{25,34}`
   - Bitcoin Bech32: `bc1[a-zA-HJ-NP-Z0-9]{25,90}`

### Concurrency Protection

The OFAC service has an `isUpdating` flag that prevents multiple update processes from running simultaneously. If an update is already in progress, subsequent requests return an error without interrupting the current operation.

---

## Webhook System

### Configuration

```typescript
cryptoPayments.configure({
  webhookUrl: 'https://your-domain.com/webhook',
  webhookSecret: 'your-secret-key',
});
```

### Events

| Event | Description |
|-------|-------------|
| `payment.created` | Payment initiated |
| `payment.confirmed` | Payment confirmed on blockchain |
| `payment.expired` | Payment expired (30-minute timeout) |
| `payment.failed` | Payment failed |
| `subscription.activated` | Subscription activated/renewed |
| `subscription.expired` | Subscription expired |

### Payload Format

```json
{
  "event": "payment.confirmed",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "data": {
    "paymentId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
    "userId": "user-123",
    "amount": "19.99",
    "token": "USDC",
    "network": "arbitrum",
    "txHash": "0xabc123..."
  }
}
```

### Webhook Headers

| Header | Description |
|--------|-------------|
| `x-webhook-signature` | HMAC-SHA256 payload signature |
| `Content-Type` | `application/json` |

### Signature Verification

```typescript
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage in Express
app.post('/webhook', (req, res) => {
  const isValid = verifyWebhook(
    JSON.stringify(req.body),
    req.headers['x-webhook-signature'] as string,
    'your-secret-key'
  );
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process the event...
  res.json({ received: true });
});
```

### Retry Policy

- Automatic retries with exponential backoff
- Cron job every 2 minutes checks for failed webhooks
- Delivery statuses logged in the `webhook_logs` table

---

## Blockchain Monitoring

### Architecture

The monitoring system consists of two services:

**EVM Blockchain Service** (`evmBlockchainService.ts`):
- Uses Alchemy SDK to monitor Arbitrum and Ethereum networks
- Checks ERC-20 token transfers (USDT/USDC) to the receiver address
- Verifies amount, sender address, and token
- Requires the `ALCHEMY_API_KEY` environment variable

**Tron Blockchain Service** (`tronBlockchainService.ts`):
- Uses TronGrid API to monitor the Tron network
- Checks TRC-20 token transfers to the receiver address
- Optionally uses `TRONGRID_API_KEY` for higher rate limits

### Monitoring Flow

1. **Monitoring queue**: Payments in `awaiting_confirmation` status are added to the queue
2. **Polling**: The system polls the blockchain every 5 seconds for each payment in the queue
3. **Transaction matching**: Checks whether a transaction matches in terms of amount, sender, and token
4. **Confirmation**: After reaching the required number of confirmations, the payment status changes to `confirmed`
5. **Subscription activation**: Automatic subscription activation after payment confirmation
6. **Webhook**: Confirmation notification sent to the configured URL

### Transaction Detection

The system looks for ERC-20/TRC-20 token transfers that meet all criteria:
- Destination address = configured receiver address
- Token = selected token (USDT/USDC)
- Amount = exact payment amount
- Sender address = encrypted sender address (compared via HMAC)

---

## Scheduled Jobs

The system runs 5 scheduled jobs:

| Job | Schedule | Description |
|-----|----------|-------------|
| Check new payments | Every 1 minute | Adds new payments to the blockchain monitoring queue |
| Expire payments | Every 5 minutes | Marks payments older than 30 minutes as `expired` |
| Expire subscriptions | Every 1 hour | Checks and expires subscriptions past their end date |
| Retry webhooks | Every 2 minutes | Retries failed webhook deliveries |
| **OFAC update** | **Daily at 00:00 UTC** | **Downloads and parses the current SDN list from US Treasury** |

---

## Security & Encryption

### Sender Address Encryption

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Initialization Vector (IV)**: 16 random bytes generated for each encryption
- **Authentication Tag**: 16 bytes (ensures data integrity)
- **Encryption Key**: Derived from `SESSION_SECRET` via `scrypt` with `payment-salt` salt
- **Storage Format**: `iv_hex:auth_tag_hex:encrypted_hex`

### Address Matching (HMAC)

- Sender addresses are hashed via HMAC-SHA256 for secure lookup
- HMAC key derived from `SESSION_SECRET`
- Enables fast address comparison without decryption

### Webhook Signatures

- HMAC-SHA256 with a separate webhook secret key
- Verification using `crypto.timingSafeEqual()` (protection against timing attacks)

### Payment Timeout

- Every payment expires 30 minutes after initiation
- Expired payments are automatically marked by the scheduler
- Prevents stale payments from lingering in the system

### OFAC Compliance

- Sender address is checked against the official SDN sanctions list
- List is updated daily at midnight UTC
- Payments from sanctioned addresses are automatically blocked
- Frontend displays real-time warnings

---

## Database Schema

### Table: tenants
Configuration management (single "default" tenant in native library mode).

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) PK | UUID |
| name | TEXT | Tenant name |
| api_key | VARCHAR(64) | API key (legacy) |
| api_key_hash | VARCHAR(128) | API key hash |
| webhook_url | TEXT | Webhook URL |
| webhook_secret | VARCHAR(64) | Webhook secret key |
| payment_address_evm | VARCHAR(42) | EVM address |
| payment_address_tron | VARCHAR(34) | Tron address |
| is_active | BOOLEAN | Whether active |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last update date |

### Table: plans
Subscription plans.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) PK | UUID |
| tenant_id | VARCHAR(36) FK | Reference to tenants |
| plan_key | VARCHAR(50) | Unique plan key |
| name | TEXT | Plan name |
| description | TEXT | Description |
| price | DECIMAL(18,6) | Price |
| currency | ENUM | USDT or USDC |
| period_days | INTEGER | Period in days |
| features | TEXT[] | Feature list |
| is_active | BOOLEAN | Whether active |
| created_at | TIMESTAMP | Creation date |

### Table: payments
Payment records.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) PK | UUID |
| tenant_id | VARCHAR(36) FK | Reference to tenants |
| external_user_id | VARCHAR(255) | User ID in external system |
| plan_id | VARCHAR(36) FK | Reference to plans |
| amount | DECIMAL(18,6) | Amount |
| token | ENUM | USDT or USDC |
| network | ENUM | arbitrum, ethereum, tron |
| sender_address_encrypted | TEXT | Encrypted sender address (AES-256-GCM) |
| sender_address_hmac | VARCHAR(128) | Sender address HMAC |
| receiver_address | VARCHAR(100) | Receiver address |
| status | ENUM | pending, awaiting_confirmation, confirmed, expired, failed, cancelled |
| tx_hash | VARCHAR(100) | Blockchain transaction hash |
| tx_confirmed_at | TIMESTAMP | Confirmation date |
| confirmations | INTEGER | Number of confirmations |
| error_message | TEXT | Error message |
| retry_count | INTEGER | Number of retries |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last update date |
| expires_at | TIMESTAMP | Expiration date |

### Table: subscriptions
User subscriptions.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) PK | UUID |
| tenant_id | VARCHAR(36) FK | Reference to tenants |
| external_user_id | VARCHAR(255) | User ID |
| plan_id | VARCHAR(36) FK | Reference to plans |
| payment_id | VARCHAR(36) FK | Reference to payments |
| status | ENUM | active, expired, cancelled |
| starts_at | TIMESTAMP | Subscription start |
| ends_at | TIMESTAMP | Subscription end |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last update date |

### Table: webhook_logs
Webhook delivery records.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) PK | UUID |
| tenant_id | VARCHAR(36) FK | Reference to tenants |
| event | ENUM | Event type |
| payload | TEXT | Payload content |
| url | TEXT | Destination URL |
| response_status | INTEGER | HTTP response code |
| response_body | TEXT | Response content |
| success | BOOLEAN | Whether delivered successfully |
| retry_count | INTEGER | Number of retries |
| next_retry_at | TIMESTAMP | Next retry time |
| created_at | TIMESTAMP | Creation date |

### Table: ofac_sanctioned_addresses
Sanctioned cryptocurrency addresses from the OFAC SDN list.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) PK | UUID |
| address | VARCHAR(256) | Original address |
| address_lower | VARCHAR(256) | Normalized (lowercase) — indexed |
| address_type | VARCHAR(50) | Network type |
| sdn_name | TEXT | SDN entity name |
| sdn_id | VARCHAR(50) | OFAC entity ID |
| source | VARCHAR(50) | Source (OFAC_SDN) |
| created_at | TIMESTAMP | Date added |
| last_seen_at | TIMESTAMP | Last confirmed on list |

### Table: ofac_update_log
OFAC list update history.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) PK | UUID |
| total_addresses | INTEGER | Total address count |
| new_addresses | INTEGER | New addresses |
| removed_addresses | INTEGER | Removed addresses |
| source_url | TEXT | Source URL |
| success | BOOLEAN | Success status |
| error_message | TEXT | Error (if any) |
| created_at | TIMESTAMP | Update timestamp |

### Indexes

- `idx_ofac_address_lower` — fast OFAC address lookup
- `idx_ofac_address_type` — filtering by network type
- `idx_payments_status` — filtering payments by status
- `idx_payments_sender_hmac` — lookup by address HMAC
- `idx_payments_tenant_user` — user payments
- `idx_payments_expires` — expiring payments
- `idx_payments_tx_hash` — lookup by transaction hash
- `idx_subscriptions_tenant_user` — user subscriptions
- `idx_subscriptions_status` — subscription filtering
- `idx_subscriptions_ends_at` — expiring subscriptions

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SESSION_SECRET` | Secret key for encryption and key derivation | Yes |
| `ALCHEMY_API_KEY` | Alchemy API key for EVM monitoring (Arbitrum, Ethereum) | Yes |
| `PAYMENT_ADDRESS_EVM` | Default EVM payment receiver address (0x...) | Yes |
| `PAYMENT_ADDRESS_TRON` | Default Tron payment receiver address (T...) | Yes |
| `TRONGRID_API_KEY` | TronGrid API key (optional, for higher rate limits) | No |
| `WEBHOOK_URL` | URL for webhook notifications | No |
| `WEBHOOK_SECRET` | Secret key for webhook signing | No |

---

## Project Structure

```
/
├── client/                          # React Frontend
│   └── src/
│       ├── components/ui/           # shadcn/ui components
│       ├── hooks/                   # Custom hooks
│       ├── lib/                     # Utilities (queryClient, utils)
│       ├── pages/
│       │   ├── home.tsx             # Home page
│       │   ├── payment.tsx          # Payment demo UI (with OFAC check)
│       │   ├── admin.tsx            # Admin panel
│       │   └── not-found.tsx        # 404 page
│       ├── App.tsx                  # Main component with routing
│       └── main.tsx                 # Entry point
│
├── server/                          # Express Backend
│   ├── config/
│   │   └── networks.ts              # Network and token configuration
│   ├── controllers/
│   │   ├── paymentController.ts     # Payment controller
│   │   ├── subscriptionController.ts # Subscription controller
│   │   └── tenantController.ts      # Tenant controller
│   ├── jobs/
│   │   └── paymentScheduler.ts      # Scheduled jobs (5 jobs including OFAC)
│   ├── lib/
│   │   └── cryptoPayments.ts        # Main library class (with OFAC check)
│   ├── middleware/
│   │   ├── apiAuth.ts               # Auth middleware (legacy)
│   │   └── rateLimit.ts             # Rate limiting
│   ├── services/
│   │   ├── blockchainMonitorService.ts  # Blockchain monitoring
│   │   ├── evmBlockchainService.ts      # EVM service (Alchemy)
│   │   ├── tronBlockchainService.ts     # Tron service (TronGrid)
│   │   ├── ofacService.ts               # OFAC service (SDN list)
│   │   ├── paymentService.ts            # Payment logic
│   │   ├── subscriptionService.ts       # Subscription logic
│   │   ├── tenantService.ts             # Tenant logic
│   │   └── webhookService.ts            # Webhook logic
│   ├── utils/
│   │   ├── addressValidation.ts     # EVM/Tron address validation
│   │   └── encryption.ts           # AES-256-GCM encryption, HMAC, signatures
│   ├── db.ts                        # Database connection
│   ├── index.ts                     # Server entry point (with OFAC initialization)
│   ├── routes.ts                    # API endpoint definitions (including OFAC)
│   ├── seed.ts                      # Seed data (default tenant, plans)
│   ├── storage.ts                   # Database abstraction layer
│   ├── static.ts                    # Static file serving
│   └── vite.ts                      # Vite dev server configuration
│
├── shared/
│   └── schema.ts                    # Database schema (Drizzle ORM) + types + OFAC tables
│
├── drizzle.config.ts                # Drizzle Kit configuration
├── package.json                     # Project dependencies
├── tailwind.config.ts               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
└── vite.config.ts                   # Vite configuration
```

---

## Frontend — Demo UI

### Available Pages

| Path | Description |
|------|-------------|
| `/` | Home page |
| `/pay` | Payment demo interface (4 steps) |
| `/admin` | Admin panel |

### Payment Flow (Demo UI) — 4 Steps

1. **Plan Selection**: Displays available subscription plans with prices and features
2. **Payment Form**: Network selection, token selection, and wallet address input
   - Automatic OFAC check with 500ms debounce
   - Status icons: loading (spinner), clean (green shield), sanctioned (red shield)
   - "Continue" button disabled for sanctioned addresses
   - Full OFAC warning alert for sanctioned addresses
3. **Payment Instructions**: QR code with address, exact amount, expiration timer
4. **Status**: Auto-refresh every 5 seconds, transaction hash displayed after confirmation

---

## Development & Testing

### Running the Project

```bash
# Install dependencies
npm install

# Start development server (frontend + backend)
npm run dev

# Sync database schema
npm run db:push
```

### Key NPM Packages

| Package | Purpose |
|---------|---------|
| `alchemy-sdk` | EVM blockchain monitoring |
| `drizzle-orm` | Database ORM |
| `drizzle-kit` | DB migration tools |
| `node-cron` | Scheduled jobs |
| `fast-xml-parser` | OFAC XML parsing |
| `zod` | Data validation |
| `@tanstack/react-query` | Server state management (v5) |
| `qrcode.react` | QR code generation |
| `wouter` | React routing |

### Demo UI

Visit `/pay` to test the complete payment flow with the built-in demo interface.

---

## License

MIT

---

Built by [Future and Code](https://futureandcode.com)
