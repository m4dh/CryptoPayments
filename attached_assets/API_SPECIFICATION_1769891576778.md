# Crypto Payments - API Specification

## Przegląd

API dla systemu płatności kryptowalutowych USDT/USDC.

## Base URL

```
Development: http://localhost:3001/api/payments
Production:  https://cfdtrader.app/api/payments
```

## Authentication

Wszystkie endpointy wymagają aktywnej sesji użytkownika (zalogowany użytkownik).

### Headers
```
Cookie: connect.sid=<session_id>
```

### Error Response (401)
```json
{
  "error": "Unauthorized",
  "message": "Session expired or invalid"
}
```

---

## Endpoints

### Plans

#### GET /api/payments/plans
Pobierz dostępne plany subskrypcyjne.

**Response:**
```json
{
  "plans": [
    {
      "id": "standard",
      "name": "Standard",
      "price": 0,
      "currency": "USDC",
      "period": "lifetime",
      "features": [
        "all_features",
        "unlimited_trades",
        "unlimited_wallets",
        "unlimited_exchanges",
        "no_ads",
        "full_support"
      ]
    },
    {
      "id": "pro_monthly",
      "name": "Pro",
      "price": 19.99,
      "currency": "USDC",
      "period": "monthly",
      "features": [
        "all_standard_features",
        "ai_trading_signals",
        "whale_tracking",
        "priority_support"
      ],
      "available": false,
      "comingSoon": true
    }
  ]
}
```

---

### Networks

#### GET /api/payments/networks
Pobierz obsługiwane sieci i tokeny.

**Response:**
```json
{
  "networks": [
    {
      "id": "arbitrum",
      "name": "Arbitrum",
      "chainId": 42161,
      "tokens": ["USDT", "USDC"],
      "estimatedFee": "$0.01",
      "confirmationTime": "~1 minute",
      "recommended": true
    },
    {
      "id": "tron",
      "name": "Tron",
      "tokens": ["USDT", "USDC"],
      "estimatedFee": "$0.50",
      "confirmationTime": "~3 minutes",
      "recommended": false
    },
    {
      "id": "ethereum",
      "name": "Ethereum",
      "chainId": 1,
      "tokens": ["USDT", "USDC"],
      "estimatedFee": "$2-5",
      "confirmationTime": "~5 minutes",
      "recommended": false
    }
  ]
}
```

---

### Payments

#### POST /api/payments/initiate
Inicjuj nową płatność.

**Request:**
```json
{
  "planId": "pro_monthly",
  "network": "arbitrum",
  "token": "USDC",
  "senderAddress": "0x1234567890abcdef1234567890abcdef12345678"
}
```

**Validation:**
- `planId`: wymagane, musi być dostępnym planem
- `network`: wymagane, enum: `arbitrum` | `tron` | `ethereum`
- `token`: wymagane, enum: `USDT` | `USDC`
- `senderAddress`: wymagane, prawidłowy adres dla wybranej sieci

**Response (200):**
```json
{
  "paymentId": 123,
  "receiverAddress": "0xabcd...1234",
  "amount": "19.99",
  "token": "USDC",
  "network": "arbitrum",
  "expiresAt": "2026-01-25T12:30:00Z",
  "expiresIn": 1800,
  "qrCodeData": "0xabcd...1234",
  "instructions": {
    "step1": "Otwórz swój portfel (MetaMask, Trust Wallet, etc.)",
    "step2": "Wyślij dokładnie 19.99 USDC na podany adres",
    "step3": "Poczekaj na potwierdzenie transakcji",
    "step4": "Kliknij 'Zapłaciłem' po wysłaniu"
  }
}
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | INVALID_PLAN | Plan nie istnieje lub niedostępny |
| 400 | INVALID_NETWORK | Nieobsługiwana sieć |
| 400 | INVALID_TOKEN | Nieobsługiwany token |
| 400 | INVALID_ADDRESS | Nieprawidłowy format adresu |
| 409 | PENDING_EXISTS | Użytkownik ma już oczekującą płatność |

---

#### POST /api/payments/:id/confirm
Potwierdź wysłanie płatności (rozpocznij monitoring).

**Parameters:**
- `id`: ID płatności

**Response (200):**
```json
{
  "success": true,
  "message": "Payment monitoring started",
  "status": "awaiting_confirmation",
  "estimatedConfirmationTime": "1-5 minutes"
}
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 404 | NOT_FOUND | Płatność nie istnieje |
| 403 | FORBIDDEN | Płatność nie należy do użytkownika |
| 400 | INVALID_STATUS | Płatność nie jest w stanie `pending` |
| 400 | EXPIRED | Płatność wygasła |

---

#### GET /api/payments/:id/status
Sprawdź status płatności.

**Parameters:**
- `id`: ID płatności

**Response (200) - pending:**
```json
{
  "paymentId": 123,
  "status": "pending",
  "amount": "19.99",
  "token": "USDC",
  "network": "arbitrum",
  "receiverAddress": "0xabcd...1234",
  "expiresAt": "2026-01-25T12:30:00Z",
  "expiresIn": 1500
}
```

**Response (200) - awaiting_confirmation:**
```json
{
  "paymentId": 123,
  "status": "awaiting_confirmation",
  "amount": "19.99",
  "token": "USDC",
  "network": "arbitrum",
  "checkingBlockchain": true,
  "lastChecked": "2026-01-25T12:01:30Z",
  "expiresAt": "2026-01-25T12:30:00Z",
  "expiresIn": 1200
}
```

**Response (200) - confirmed:**
```json
{
  "paymentId": 123,
  "status": "confirmed",
  "amount": "19.99",
  "token": "USDC",
  "network": "arbitrum",
  "txHash": "0x123...abc",
  "txUrl": "https://arbiscan.io/tx/0x123...abc",
  "confirmations": 5,
  "confirmedAt": "2026-01-25T12:05:00Z",
  "subscription": {
    "planId": "pro_monthly",
    "startsAt": "2026-01-25T12:05:00Z",
    "endsAt": "2026-02-25T12:05:00Z"
  }
}
```

**Response (200) - expired:**
```json
{
  "paymentId": 123,
  "status": "expired",
  "amount": "19.99",
  "token": "USDC",
  "network": "arbitrum",
  "expiredAt": "2026-01-25T12:30:00Z",
  "message": "Płatność wygasła. Utwórz nową płatność."
}
```

---

#### GET /api/payments/history
Pobierz historię płatności użytkownika.

**Query Parameters:**
- `limit` (optional): max 50, default 20
- `offset` (optional): for pagination
- `status` (optional): filter by status

**Response:**
```json
{
  "payments": [
    {
      "id": 123,
      "planId": "pro_monthly",
      "amount": "19.99",
      "token": "USDC",
      "network": "arbitrum",
      "status": "confirmed",
      "txHash": "0x123...abc",
      "createdAt": "2026-01-25T12:00:00Z",
      "confirmedAt": "2026-01-25T12:05:00Z"
    },
    {
      "id": 120,
      "planId": "pro_monthly",
      "amount": "19.99",
      "token": "USDT",
      "network": "tron",
      "status": "expired",
      "createdAt": "2026-01-20T10:00:00Z",
      "expiredAt": "2026-01-20T10:30:00Z"
    }
  ],
  "total": 2,
  "hasMore": false
}
```

---

#### DELETE /api/payments/:id
Anuluj oczekującą płatność.

**Parameters:**
- `id`: ID płatności

**Response (200):**
```json
{
  "success": true,
  "message": "Payment cancelled"
}
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 404 | NOT_FOUND | Płatność nie istnieje |
| 403 | FORBIDDEN | Płatność nie należy do użytkownika |
| 400 | CANNOT_CANCEL | Płatność nie jest w stanie pending |

---

### Subscriptions

#### GET /api/subscriptions/current
Pobierz aktualną subskrypcję użytkownika.

**Response (200) - with subscription:**
```json
{
  "hasSubscription": true,
  "subscription": {
    "id": 45,
    "planId": "pro_monthly",
    "planName": "Pro",
    "status": "active",
    "startsAt": "2026-01-25T12:05:00Z",
    "endsAt": "2026-02-25T12:05:00Z",
    "daysRemaining": 28,
    "autoRenew": false,
    "paymentId": 123
  }
}
```

**Response (200) - no subscription:**
```json
{
  "hasSubscription": false,
  "subscription": null,
  "defaultPlan": "standard"
}
```

---

### Address Validation

#### POST /api/payments/validate-address
Waliduj adres portfela przed inicjacją płatności.

**Request:**
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "network": "arbitrum"
}
```

**Response (200) - valid:**
```json
{
  "valid": true,
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "network": "arbitrum",
  "checksumAddress": "0x1234567890AbCdEf1234567890aBcDeF12345678"
}
```

**Response (200) - invalid:**
```json
{
  "valid": false,
  "address": "0xinvalid",
  "network": "arbitrum",
  "error": "Invalid EVM address format"
}
```

---

## Webhook (Internal)

### POST /api/payments/webhook/confirmed
Wewnętrzny webhook wywoływany przez blockchain monitor.

**Request:**
```json
{
  "paymentId": 123,
  "txHash": "0x123...abc",
  "confirmations": 5,
  "amount": "19990000",
  "token": "USDC",
  "network": "arbitrum",
  "timestamp": "2026-01-25T12:05:00Z"
}
```

**Headers:**
```
X-Webhook-Secret: <internal_secret>
```

---

## Status Codes

| Status | Description |
|--------|-------------|
| `pending` | Płatność utworzona, czeka na wysłanie |
| `awaiting_confirmation` | Użytkownik potwierdził wysłanie, monitoring aktywny |
| `confirmed` | Transakcja potwierdzona, subskrypcja aktywna |
| `expired` | Timeout 30 minut, płatność wygasła |
| `failed` | Błąd (np. nieprawidłowa kwota) |
| `cancelled` | Anulowana przez użytkownika |

---

## Rate Limits

| Endpoint Category | Limit |
|-------------------|-------|
| GET endpoints | 60 req/min |
| POST /initiate | 5 req/min |
| POST /confirm | 10 req/min |
| GET /status | 120 req/min (polling) |

---

## Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 400 | BAD_REQUEST | Invalid parameters |
| 401 | UNAUTHORIZED | Session invalid |
| 403 | FORBIDDEN | Not authorized for this resource |
| 404 | NOT_FOUND | Resource doesn't exist |
| 409 | CONFLICT | Resource conflict (e.g., pending payment exists) |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

**Standard Error Response:**
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "details": {}
}
```

---

## Frontend Integration

### React Query Hooks

```typescript
// usePaymentPlans
const { data: plans } = useQuery({
  queryKey: ['payment-plans'],
  queryFn: () => api.get('/payments/plans'),
});

// useInitiatePayment
const mutation = useMutation({
  mutationFn: (data: InitiatePaymentParams) => 
    api.post('/payments/initiate', data),
});

// usePaymentStatus (polling)
const { data: status } = useQuery({
  queryKey: ['payment-status', paymentId],
  queryFn: () => api.get(`/payments/${paymentId}/status`),
  refetchInterval: (data) => 
    data?.status === 'awaiting_confirmation' ? 5000 : false,
  enabled: !!paymentId,
});
```

### Status Polling Strategy

```typescript
// Poll every 5 seconds while awaiting_confirmation
// Stop polling when:
// - status === 'confirmed' (success)
// - status === 'expired' (timeout)
// - status === 'failed' (error)

const shouldPoll = (status: string) => 
  status === 'awaiting_confirmation' || status === 'pending';
```
