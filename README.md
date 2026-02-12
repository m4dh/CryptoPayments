# Crypto Payment Library

Natywna biblioteka do obslugi platnosci kryptowalutowych USDT/USDC na sieciach Arbitrum, Ethereum i Tron. Zaprojektowana do bezposredniej integracji z aplikacja - bez zewnetrznych wywolan API, bez kluczy autoryzacyjnych. System zawiera monitoring blockchain w czasie rzeczywistym, szyfrowane przechowywanie adresow, system webhookow oraz weryfikacje OFAC (Office of Foreign Assets Control) blokujaca transakcje z sankcjonowanych adresow.

---

## Spis tresci

1. [Glowne funkcjonalnosci](#glowne-funkcjonalnosci)
2. [Obslugiwane sieci](#obslugiwane-sieci)
3. [Architektura systemu](#architektura-systemu)
4. [Szybki start](#szybki-start)
5. [API biblioteki (natywne)](#api-biblioteki-natywne)
6. [REST API](#rest-api)
7. [System OFAC - weryfikacja sankcji](#system-ofac---weryfikacja-sankcji)
8. [System webhookow](#system-webhookow)
9. [Monitoring blockchain](#monitoring-blockchain)
10. [Zadania cykliczne (Scheduler)](#zadania-cykliczne-scheduler)
11. [Bezpieczenstwo i szyfrowanie](#bezpieczenstwo-i-szyfrowanie)
12. [Baza danych - schemat](#baza-danych---schemat)
13. [Zmienne srodowiskowe](#zmienne-srodowiskowe)
14. [Struktura projektu](#struktura-projektu)
15. [Frontend - Demo UI](#frontend---demo-ui)
16. [Rozwoj i testowanie](#rozwoj-i-testowanie)

---

## Glowne funkcjonalnosci

- **Platnosci wielosieciowe**: Arbitrum (rekomendowany), Ethereum, Tron
- **Stablecoiny**: USDT i USDC na wszystkich wspieranych sieciach
- **Natywna biblioteka**: Import i uzycie bezposrednie - bez kluczy API
- **Monitoring blockchain**: Wykrywanie transakcji w czasie rzeczywistym przez Alchemy SDK (EVM) i TronGrid (Tron)
- **Weryfikacja OFAC**: Automatyczne sprawdzanie adresow nadawcow wobec listy sankcji SDN Departamentu Skarbu USA
- **Webhooks**: Opcjonalne powiadomienia z podpisem HMAC-SHA256 i automatycznymi ponownymi proba
- **Szyfrowanie**: AES-256-GCM dla wrażliwych danych adresowych
- **Demo UI**: Wbudowany interfejs platnosci do testowania
- **Plany subskrypcyjne**: Zarzadzanie planami cenowymi z automatyczna aktywacja subskrypcji
- **QR Code**: Generowanie kodow QR dla adresow portfeli

---

## Obslugiwane sieci

| Siec | Tokeny | Chain ID | Szacunkowa oplata | Czas potwierdzenia | Min. potwierdzen | Rekomendowana |
|------|--------|----------|-------------------|---------------------|------------------|---------------|
| Arbitrum One | USDT, USDC | 42161 | ~$0.01 | ~1 minuta | 3 | Tak |
| Ethereum | USDT, USDC | 1 | ~$2-5 | ~5 minut | 12 | Nie |
| Tron | USDT, USDC | - | ~$0.50 | ~3 minuty | 20 | Nie |

### Adresy kontraktow tokenow

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

## Architektura systemu

### Stos technologiczny

**Frontend:**
- React 18 z TypeScript
- Wouter (routing)
- TanStack React Query (zarzadzanie stanem serwera)
- shadcn/ui + Radix UI (komponenty UI)
- Tailwind CSS (stylowanie)
- Vite (build tool)
- qrcode.react (generowanie QR)

**Backend:**
- Express.js z TypeScript
- Drizzle ORM z PostgreSQL
- Alchemy SDK (monitoring EVM)
- TronGrid API (monitoring Tron)
- node-cron (zadania cykliczne)
- fast-xml-parser (parsowanie OFAC XML)
- Zod (walidacja danych)

### Diagram przeplywu platnosci

```
Uzytkownik          Biblioteka              Blockchain         OFAC
    |                   |                       |               |
    |-- Inicjuj ---->   |                       |               |
    |                   |-- Sprawdz OFAC ------>|               |
    |                   |<-- Czysty/Sankcja ----|               |
    |                   |                       |               |
    |<-- Adres + QR ----|                       |               |
    |                   |                       |               |
    |-- Wyslij TX ----->|                       |               |
    |                   |                       |               |
    |-- Potwierdz ----->|                       |               |
    |                   |-- Monitoruj --------->|               |
    |                   |<-- TX znaleziony -----|               |
    |                   |                       |               |
    |<-- Potwierdzony --|                       |               |
    |                   |-- Webhook ----------->|               |
```

---

## Szybki start

### 1. Konfiguracja zmiennych srodowiskowych

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SESSION_SECRET=twoj-tajny-klucz-min-32-znaki
ALCHEMY_API_KEY=twoj-klucz-alchemy
PAYMENT_ADDRESS_EVM=0x...twoj-adres-evm
PAYMENT_ADDRESS_TRON=T...twoj-adres-tron
```

### 2. Import i konfiguracja

```typescript
import { cryptoPayments } from './lib/cryptoPayments';

// Opcjonalnie: nadpisz adresy platnicze
cryptoPayments.configure({
  paymentAddressEvm: '0x...',
  paymentAddressTron: 'T...',
  webhookUrl: 'https://twoja-domena.com/webhook',
  webhookSecret: 'twoj-tajny-klucz-webhook',
});
```

### 3. Stworz plan subskrypcyjny

```typescript
await cryptoPayments.createPlan({
  planKey: 'pro-monthly',
  name: 'Pro Miesiecznie',
  description: 'Pelny dostep do platformy',
  price: '19.99',
  currency: 'USDC',
  periodDays: 30,
  features: ['Wszystkie funkcje', 'Priorytetowe wsparcie'],
});
```

### 4. Zainicjuj platnosc

```typescript
const payment = await cryptoPayments.initiatePayment({
  userId: 'user-123',
  planId: 'plan-uuid',
  network: 'arbitrum',
  token: 'USDC',
  senderAddress: '0x...adres-nadawcy',
});

// Jesli adres jest na liscie sankcji OFAC, zostanie
// rzucony blad: "OFAC_SANCTIONED: Address ... is on the OFAC SDN sanctions list"

console.log('Wyslij platnosc na:', payment.receiverAddress);
console.log('Kwota:', payment.amount, payment.token);
console.log('Wygasa za:', payment.expiresIn, 'sekund');
```

### 5. Potwierdz wyslanie platnosci

```typescript
// Po wyslaniu transakcji przez uzytkownika
await cryptoPayments.confirmPaymentSent(payment.paymentId);
// System automatycznie monitoruje blockchain i potwierdza transakcje
```

### 6. Sprawdz status platnosci

```typescript
const status = await cryptoPayments.getPaymentStatus(payment.paymentId);
console.log('Status:', status.status);
// pending -> awaiting_confirmation -> confirmed / expired / failed
```

---

## API biblioteki (natywne)

### Konfiguracja

```typescript
cryptoPayments.configure({
  paymentAddressEvm?: string,    // Adres odbioru EVM
  paymentAddressTron?: string,   // Adres odbioru Tron
  webhookUrl?: string,           // URL powiadomien webhook
  webhookSecret?: string,        // Tajny klucz HMAC webhook
});
```

### Plany subskrypcyjne

```typescript
// Pobierz wszystkie plany
const plans = await cryptoPayments.getPlans();

// Pobierz plan po ID
const plan = await cryptoPayments.getPlan('plan-uuid');

// Pobierz plan po kluczu
const plan = await cryptoPayments.getPlanByKey('pro-monthly');

// Stworz plan
const newPlan = await cryptoPayments.createPlan({
  planKey: string,          // Unikalny identyfikator planu
  name: string,             // Nazwa wyswietlana
  description?: string,     // Opis planu
  price: string,            // Cena (np. '19.99')
  currency?: 'USDT' | 'USDC',  // Waluta (domyslnie USDC)
  periodDays?: number,      // Okres subskrypcji w dniach
  features?: string[],      // Lista funkcji planu
});
```

### Sieci

```typescript
// Pobierz wszystkie wspierane sieci
const networks = cryptoPayments.getNetworks();
// Zwraca: { id, name, chainId, tokens, estimatedFee, confirmationTime, recommended }[]

// Pobierz informacje o konkretnej sieci
const arbitrum = cryptoPayments.getNetwork('arbitrum');
```

### Platnosci

```typescript
// Zainicjuj platnosc (z automatycznym sprawdzeniem OFAC)
const payment = await cryptoPayments.initiatePayment({
  userId: string,                              // ID uzytkownika w Twojej aplikacji
  planId: string,                              // UUID planu
  network: 'arbitrum' | 'ethereum' | 'tron',   // Siec blockchain
  token: 'USDT' | 'USDC',                     // Token platnosci
  senderAddress: string,                        // Adres portfela nadawcy
});
// Zwraca: { paymentId, amount, token, network, receiverAddress, expiresAt, expiresIn }
// Blad jesli adres na liscie OFAC: throw Error('OFAC_SANCTIONED: ...')

// Potwierdz wyslanie platnosci (uruchamia monitoring blockchain)
const status = await cryptoPayments.confirmPaymentSent(paymentId);

// Sprawdz status platnosci
const status = await cryptoPayments.getPaymentStatus(paymentId);
// Zwraca: { paymentId, status, amount, token, network, txHash, confirmedAt }

// Pobierz historie platnosci uzytkownika
const history = await cryptoPayments.getPaymentHistory(userId, limit?);

// Anuluj platnosc (tylko w statusie pending/awaiting_confirmation)
await cryptoPayments.cancelPayment(paymentId);
```

### Subskrypcje

```typescript
// Pobierz aktywna subskrypcje uzytkownika
const subscription = await cryptoPayments.getCurrentSubscription(userId);
// Zwraca: { id, planId, status, startsAt, endsAt } | null

// Pobierz historie subskrypcji
const history = await cryptoPayments.getSubscriptionHistory(userId);
```

### Walidacja adresow

```typescript
// Zwaliduj adres blockchain
const result = cryptoPayments.validateAddress(address, network);
// Zwraca: { valid: boolean, error?: string }
```

---

## REST API

Dla aplikacji preferujacych integracje przez REST API:

### Endpointy podstawowe

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/health` | Status zdrowia systemu |
| GET | `/api/networks` | Lista wspieranych sieci |
| GET | `/api/plans` | Lista dostepnych planow |
| POST | `/api/plans` | Stworz nowy plan |
| POST | `/api/payments` | Zainicjuj nowa platnosc |
| POST | `/api/payments/:id/confirm` | Potwierdz wyslanie platnosci |
| GET | `/api/payments/:id/status` | Sprawdz status platnosci |
| GET | `/api/payments/history/:userId` | Historia platnosci uzytkownika |
| DELETE | `/api/payments/:id` | Anuluj platnosc |
| POST | `/api/validate-address` | Zwaliduj adres blockchain |
| GET | `/api/subscriptions/:userId` | Aktywna subskrypcja uzytkownika |
| GET | `/api/subscriptions/:userId/history` | Historia subskrypcji |

### Endpointy OFAC

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/ofac/status` | Status systemu OFAC |
| GET | `/api/ofac/check/:address` | Sprawdz adres wobec listy sankcji |
| POST | `/api/ofac/update` | Wymus aktualizacje listy OFAC |

### Przyklady uzycia REST API

#### Inicjacja platnosci

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

Odpowiedz (sukces):
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

Odpowiedz (adres sankcjonowany):
```json
{
  "error": "OFAC_SANCTIONED: Address 0x... is on the OFAC SDN sanctions list (EXAMPLE ENTITY NAME). Transaction blocked for compliance."
}
```

#### Sprawdzenie adresu OFAC

```bash
curl http://localhost:5000/api/ofac/check/0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18
```

Odpowiedz:
```json
{
  "isSanctioned": false,
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  "matchedEntries": [],
  "checkedAt": "2025-01-01T12:00:00.000Z"
}
```

Odpowiedz (adres na liscie):
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

#### Status systemu OFAC

```bash
curl http://localhost:5000/api/ofac/status
```

Odpowiedz:
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

#### Wymuszona aktualizacja listy OFAC

```bash
curl -X POST http://localhost:5000/api/ofac/update
```

Odpowiedz:
```json
{
  "success": true,
  "totalAddresses": 1247,
  "newAddresses": 12,
  "removedAddresses": 3
}
```

---

## System OFAC - weryfikacja sankcji

### Opis

System OFAC (Office of Foreign Assets Control) zapewnia zgodnosc z regulacjami sankcyjnymi Departamentu Skarbu USA. Automatycznie pobiera i parsuje oficjalna liste SDN (Specially Designated Nationals and Blocked Persons) w formacie XML bezposrednio ze strony rzadu USA.

### Zrodlo danych

- **URL**: `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.XML`
- **Format**: XML (SDN_ADVANCED.XML) - okolo 116 MB
- **Parser**: `fast-xml-parser` z fallbackiem regex dla alternatywnych formatow

### Wspierane typy adresow cyfrowych

System rozpoznaje i ekstrahuje adresy kryptowalutowe oznaczone w XML jako "Digital Currency Address" nastepujacych typow:

| Ticker w XML | Typ sieci |
|-------------|-----------|
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

### Przeplyw weryfikacji OFAC

1. **Przy starcie serwera**: Jesli baza jest pusta, automatycznie pobiera i laduje pelen plik SDN_ADVANCED.XML
2. **Codziennie o polnocy UTC**: Zaplanowane zadanie cron automatycznie aktualizuje liste sankcji
3. **Przy kazdej platnosci**: Adres nadawcy jest sprawdzany wobec bazy sankcjonowanych adresow przed inicjacja platnosci
4. **Na żądanie przez API**: Endpoint `GET /api/ofac/check/:address` pozwala sprawdzic dowolny adres
5. **Reczna aktualizacja**: Endpoint `POST /api/ofac/update` pozwala wymusic natychmiastowa aktualizacje

### Integracja z przeplywem platnosci

Weryfikacja OFAC jest wbudowana bezposrednio w metode `cryptoPayments.initiatePayment()`. Przeplyw:

1. Walidacja formatu adresu (EVM lub Tron)
2. **Sprawdzenie OFAC** - porownanie adresu z baza sankcjonowanych adresow
3. Jesli adres jest na liscie -> rzucenie bledu `OFAC_SANCTIONED` z nazwa podmiotu sankcjonowanego
4. Jesli adres jest czysty -> kontynuacja tworzenia platnosci

### Frontend - wskaznik OFAC w czasie rzeczywistym

Interfejs platnosci wyswietla status sprawdzania OFAC w czasie rzeczywistym:

- **Idle**: Brak wyswietlania (adres za krotki lub nie wpisany)
- **Checking**: Animowana ikona ladowania (debounce 500ms po ostatnim nacisnięciu klawisza)
- **Clean**: Zielona ikona tarczy z tekstem "OFAC compliance check passed"
- **Sanctioned**: Czerwona ikona tarczy z pelnym komunikatem ostrzezenia i zablokowanym przyciskiem "Continue"

### Tabele bazodanowe OFAC

**ofac_sanctioned_addresses:**
| Kolumna | Typ | Opis |
|---------|-----|------|
| id | VARCHAR(36) | UUID klucz glowny |
| address | VARCHAR(256) | Oryginalny adres blockchain |
| address_lower | VARCHAR(256) | Znormalizowany adres (lowercase) - indeksowany |
| address_type | VARCHAR(50) | Typ sieci (ethereum, bitcoin, tron, itp.) |
| sdn_name | TEXT | Nazwa podmiotu na liscie SDN |
| sdn_id | VARCHAR(50) | ID podmiotu w systemie OFAC |
| source | VARCHAR(50) | Zrodlo danych (domyslnie 'OFAC_SDN') |
| created_at | TIMESTAMP | Data dodania do bazy |
| last_seen_at | TIMESTAMP | Data ostatniego potwierdzenia obecnosci na liscie |

**ofac_update_log:**
| Kolumna | Typ | Opis |
|---------|-----|------|
| id | VARCHAR(36) | UUID klucz glowny |
| total_addresses | INTEGER | Calkowita liczba adresow po aktualizacji |
| new_addresses | INTEGER | Liczba nowych adresow |
| removed_addresses | INTEGER | Liczba usunietych adresow |
| source_url | TEXT | URL zrodla danych |
| success | BOOLEAN | Czy aktualizacja sie powiodla |
| error_message | TEXT | Komunikat bledu (jesli wystapil) |
| created_at | TIMESTAMP | Data aktualizacji |

### Parsowanie XML

System stosuje dwuetapowe parsowanie:

1. **Parsowanie strukturalne** (fast-xml-parser): Analizuje strukture XML, szuka wpisow `sdnEntry`, ich `idList` i `features` zawierajacych adresy cyfrowych walut
2. **Parsowanie regex (fallback)**: Jesli parsowanie strukturalne nie znajdzie adresow, stosuje wyrazenia regularne do wykrywania adresow w formacie:
   - EVM: `0x[a-fA-F0-9]{40}`
   - Tron: `T[a-zA-Z0-9]{33}`
   - Bitcoin: `[13][a-km-zA-HJ-NP-Z1-9]{25,34}`
   - Bitcoin Bech32: `bc1[a-zA-HJ-NP-Z0-9]{25,90}`

### Zabezpieczenia przed podwojnym uruchomieniem

Serwis OFAC posiada flage `isUpdating` ktora zapobiega rownoczesnemu uruchamieniu wielu procesow aktualizacji. Jesli aktualizacja jest juz w toku, kolejne zadanie zwroci blad bez przerywania biezacej operacji.

---

## System webhookow

### Konfiguracja

```typescript
cryptoPayments.configure({
  webhookUrl: 'https://twoja-domena.com/webhook',
  webhookSecret: 'twoj-tajny-klucz',
});
```

### Zdarzenia

| Zdarzenie | Opis |
|-----------|------|
| `payment.created` | Platnosc zainicjowana |
| `payment.confirmed` | Platnosc potwierdzona na blockchain |
| `payment.expired` | Platnosc wygasla (timeout 30 minut) |
| `payment.failed` | Platnosc nieudana |
| `subscription.activated` | Subskrypcja aktywowana/odnowiona |
| `subscription.expired` | Subskrypcja wygasla |

### Format payloadu

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

### Naglowki webhook

| Naglowek | Opis |
|----------|------|
| `x-webhook-signature` | Podpis HMAC-SHA256 payloadu |
| `Content-Type` | `application/json` |

### Weryfikacja podpisu webhook

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

// Uzycie w Express
app.post('/webhook', (req, res) => {
  const isValid = verifyWebhook(
    JSON.stringify(req.body),
    req.headers['x-webhook-signature'] as string,
    'twoj-tajny-klucz'
  );
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Przetwarzaj zdarzenie...
  res.json({ received: true });
});
```

### Ponowne proby (retry)

- Automatyczne ponowne proby z wykladniczym opoznieniem (exponential backoff)
- Zadanie cron co 2 minuty sprawdza nieudane webhooks
- Rejestrowanie statusow dostawy w tabeli `webhook_logs`

---

## Monitoring blockchain

### Architektura

System monitoringu sklada sie z dwoch serwisow:

**EVM Blockchain Service** (`evmBlockchainService.ts`):
- Uzywa Alchemy SDK do monitorowania sieci Arbitrum i Ethereum
- Sprawdza transfery tokenow ERC-20 (USDT/USDC) na adres odbiorcy
- Weryfikuje kwote, adres nadawcy i token
- Wymaga zmiennej `ALCHEMY_API_KEY`

**Tron Blockchain Service** (`tronBlockchainService.ts`):
- Uzywa TronGrid API do monitorowania sieci Tron
- Sprawdza transfery tokenow TRC-20 na adres odbiorcy
- Opcjonalnie uzywa `TRONGRID_API_KEY` dla wyzszych limitow

### Przeplyw monitoringu

1. **Kolejka monitoringu**: Platnosci w statusie `awaiting_confirmation` sa dodawane do kolejki
2. **Polling**: System odpytuje blockchain co 5 sekund dla kazdej platnosci w kolejce
3. **Dopasowanie transakcji**: Sprawdza czy transakcja pasuje pod wzgledem kwoty, nadawcy i tokenu
4. **Potwierdzenie**: Po osiagnieciu wymaganej liczby potwierdzen, platnosc zmienia status na `confirmed`
5. **Aktywacja subskrypcji**: Automatyczna aktywacja subskrypcji po potwierdzeniu platnosci
6. **Webhook**: Wysylanie powiadomienia o potwierdzeniu

### Wykrywanie transakcji

System szuka transferow tokenow ERC-20/TRC-20 spelniajacych wszystkie kryteria:
- Adres docelowy = skonfigurowany adres odbiorcy
- Token = wybrany token (USDT/USDC)
- Kwota = dokladna kwota platnosci
- Adres nadawcy = zaszyfrowany adres nadawcy (porownanie przez HMAC)

---

## Zadania cykliczne (Scheduler)

System uruchamia 5 zadan cyklicznych:

| Zadanie | Harmonogram | Opis |
|---------|-------------|------|
| Sprawdzanie nowych platnosci | Co 1 minute | Dodaje nowe platnosci do kolejki monitoringu blockchain |
| Wygaszanie platnosci | Co 5 minut | Oznacza platnosci starsze niz 30 minut jako `expired` |
| Wygaszanie subskrypcji | Co 1 godzine | Sprawdza i wygasza subskrypcje po dacie zakonczenia |
| Ponowne proby webhookow | Co 2 minuty | Powtarza nieudane dostawy webhookow |
| **Aktualizacja OFAC** | **Codziennie o 00:00 UTC** | **Pobiera i parsuje aktualna liste SDN z US Treasury** |

---

## Bezpieczenstwo i szyfrowanie

### Szyfrowanie adresow nadawcow

- **Algorytm**: AES-256-GCM (Galois/Counter Mode)
- **Wektor inicjalizacji (IV)**: 16 losowych bajtow generowanych dla kazdego szyfrowania
- **Tag uwierzytelniania**: 16 bajtow (zapewnia integralnosc danych)
- **Klucz szyfrujacy**: Derywowany z `SESSION_SECRET` przez `scrypt` z solem `payment-salt`
- **Format przechowywania**: `iv_hex:auth_tag_hex:encrypted_hex`

### Dopasowanie adresow (HMAC)

- Adresy nadawcow sa hashowane przez HMAC-SHA256 do bezpiecznego wyszukiwania
- Klucz HMAC derywowany z `SESSION_SECRET`
- Umozliwia szybkie porownanie adresow bez odszyfrowania

### Podpisy webhookow

- HMAC-SHA256 z osobnym tajnym kluczem webhook
- Weryfikacja z uzyciem `crypto.timingSafeEqual()` (ochrona przed atakami timing)

### Timeout platnosci

- Kazda platnosc wygasa po 30 minutach od inicjacji
- Wygasle platnosci sa automatycznie oznaczane przez scheduler
- Zapobiega zaleganiu nieaktywnych platnosci w systemie

### OFAC Compliance

- Adres nadawcy jest sprawdzany wobec oficjalnej listy sankcji SDN
- Lista jest aktualizowana codziennie o polnocy UTC
- Platnosci z sankcjonowanych adresow sa automatycznie blokowane
- Frontend wyswietla ostrzezenie w czasie rzeczywistym

---

## Baza danych - schemat

### Tabela: tenants
Zarzadzanie konfiguracją (pojedynczy tenant "default" w trybie biblioteki natywnej).

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | VARCHAR(36) PK | UUID |
| name | TEXT | Nazwa tenanta |
| api_key | VARCHAR(64) | Klucz API (legacy) |
| api_key_hash | VARCHAR(128) | Hash klucza API |
| webhook_url | TEXT | URL webhook |
| webhook_secret | VARCHAR(64) | Tajny klucz webhook |
| payment_address_evm | VARCHAR(42) | Adres EVM |
| payment_address_tron | VARCHAR(34) | Adres Tron |
| is_active | BOOLEAN | Czy aktywny |
| created_at | TIMESTAMP | Data utworzenia |
| updated_at | TIMESTAMP | Data aktualizacji |

### Tabela: plans
Plany subskrypcyjne.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | VARCHAR(36) PK | UUID |
| tenant_id | VARCHAR(36) FK | Referencja do tenants |
| plan_key | VARCHAR(50) | Unikalny klucz planu |
| name | TEXT | Nazwa planu |
| description | TEXT | Opis |
| price | DECIMAL(18,6) | Cena |
| currency | ENUM | USDT lub USDC |
| period_days | INTEGER | Okres w dniach |
| features | TEXT[] | Lista funkcji |
| is_active | BOOLEAN | Czy aktywny |
| created_at | TIMESTAMP | Data utworzenia |

### Tabela: payments
Rejestr platnosci.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | VARCHAR(36) PK | UUID |
| tenant_id | VARCHAR(36) FK | Referencja do tenants |
| external_user_id | VARCHAR(255) | ID uzytkownika w zewnetrznym systemie |
| plan_id | VARCHAR(36) FK | Referencja do plans |
| amount | DECIMAL(18,6) | Kwota |
| token | ENUM | USDT lub USDC |
| network | ENUM | arbitrum, ethereum, tron |
| sender_address_encrypted | TEXT | Zaszyfrowany adres nadawcy (AES-256-GCM) |
| sender_address_hmac | VARCHAR(128) | HMAC adresu nadawcy |
| receiver_address | VARCHAR(100) | Adres odbiorcy |
| status | ENUM | pending, awaiting_confirmation, confirmed, expired, failed, cancelled |
| tx_hash | VARCHAR(100) | Hash transakcji blockchain |
| tx_confirmed_at | TIMESTAMP | Data potwierdzenia |
| confirmations | INTEGER | Liczba potwierdzen |
| error_message | TEXT | Komunikat bledu |
| retry_count | INTEGER | Liczba prob |
| created_at | TIMESTAMP | Data utworzenia |
| updated_at | TIMESTAMP | Data aktualizacji |
| expires_at | TIMESTAMP | Data wygasniecia |

### Tabela: subscriptions
Subskrypcje uzytkownikow.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | VARCHAR(36) PK | UUID |
| tenant_id | VARCHAR(36) FK | Referencja do tenants |
| external_user_id | VARCHAR(255) | ID uzytkownika |
| plan_id | VARCHAR(36) FK | Referencja do plans |
| payment_id | VARCHAR(36) FK | Referencja do payments |
| status | ENUM | active, expired, cancelled |
| starts_at | TIMESTAMP | Poczatek subskrypcji |
| ends_at | TIMESTAMP | Koniec subskrypcji |
| created_at | TIMESTAMP | Data utworzenia |
| updated_at | TIMESTAMP | Data aktualizacji |

### Tabela: webhook_logs
Rejestr dostarczeń webhookow.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | VARCHAR(36) PK | UUID |
| tenant_id | VARCHAR(36) FK | Referencja do tenants |
| event | ENUM | Typ zdarzenia |
| payload | TEXT | Tresc payloadu |
| url | TEXT | URL docelowy |
| response_status | INTEGER | Kod odpowiedzi HTTP |
| response_body | TEXT | Tresc odpowiedzi |
| success | BOOLEAN | Czy dostarczono pomyslnie |
| retry_count | INTEGER | Liczba prob |
| next_retry_at | TIMESTAMP | Nastepna proba |
| created_at | TIMESTAMP | Data utworzenia |

### Tabela: ofac_sanctioned_addresses
Sankcjonowane adresy kryptowalutowe z listy SDN OFAC.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | VARCHAR(36) PK | UUID |
| address | VARCHAR(256) | Oryginalny adres |
| address_lower | VARCHAR(256) | Znormalizowany (lowercase) - indeksowany |
| address_type | VARCHAR(50) | Typ sieci |
| sdn_name | TEXT | Nazwa podmiotu SDN |
| sdn_id | VARCHAR(50) | ID podmiotu OFAC |
| source | VARCHAR(50) | Zrodlo (OFAC_SDN) |
| created_at | TIMESTAMP | Data dodania |
| last_seen_at | TIMESTAMP | Ostatnie potwierdzenie |

### Tabela: ofac_update_log
Historia aktualizacji listy OFAC.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | VARCHAR(36) PK | UUID |
| total_addresses | INTEGER | Calkowita liczba adresow |
| new_addresses | INTEGER | Nowe adresy |
| removed_addresses | INTEGER | Usuniete adresy |
| source_url | TEXT | URL zrodla |
| success | BOOLEAN | Powodzenie |
| error_message | TEXT | Blad (jesli wystapil) |
| created_at | TIMESTAMP | Data aktualizacji |

### Indeksy

- `idx_ofac_address_lower` - szybkie wyszukiwanie adresow OFAC
- `idx_ofac_address_type` - filtrowanie po typie sieci
- `idx_payments_status` - filtrowanie platnosci po statusie
- `idx_payments_sender_hmac` - wyszukiwanie po HMAC adresu
- `idx_payments_tenant_user` - platnosci uzytkownika
- `idx_payments_expires` - wygasajace platnosci
- `idx_payments_tx_hash` - wyszukiwanie po hash transakcji
- `idx_subscriptions_tenant_user` - subskrypcje uzytkownika
- `idx_subscriptions_status` - filtrowanie subskrypcji
- `idx_subscriptions_ends_at` - wygasajace subskrypcje

---

## Zmienne srodowiskowe

| Zmienna | Opis | Wymagana |
|---------|------|----------|
| `DATABASE_URL` | Connection string PostgreSQL | Tak |
| `SESSION_SECRET` | Tajny klucz do szyfrowania i derywacji kluczy | Tak |
| `ALCHEMY_API_KEY` | Klucz API Alchemy do monitoringu EVM (Arbitrum, Ethereum) | Tak |
| `PAYMENT_ADDRESS_EVM` | Domyslny adres odbioru platnosci EVM (0x...) | Tak |
| `PAYMENT_ADDRESS_TRON` | Domyslny adres odbioru platnosci Tron (T...) | Tak |
| `TRONGRID_API_KEY` | Klucz API TronGrid (opcjonalny, dla wyzszych limitow) | Nie |
| `WEBHOOK_URL` | URL do wysylania powiadomien webhook | Nie |
| `WEBHOOK_SECRET` | Tajny klucz do podpisywania webhookow | Nie |

---

## Struktura projektu

```
/
├── client/                          # Frontend React
│   └── src/
│       ├── components/ui/           # Komponenty shadcn/ui
│       ├── hooks/                   # Custom hooks
│       ├── lib/                     # Utilities (queryClient, utils)
│       ├── pages/
│       │   ├── home.tsx             # Strona glowna
│       │   ├── payment.tsx          # Demo UI platnosci (z OFAC check)
│       │   ├── admin.tsx            # Panel administracyjny
│       │   └── not-found.tsx        # Strona 404
│       ├── App.tsx                  # Glowny komponent z routingiem
│       └── main.tsx                 # Punkt wejscia
│
├── server/                          # Backend Express
│   ├── config/
│   │   └── networks.ts              # Konfiguracja sieci i tokenow
│   ├── controllers/
│   │   ├── paymentController.ts     # Kontroler platnosci
│   │   ├── subscriptionController.ts # Kontroler subskrypcji
│   │   └── tenantController.ts      # Kontroler tenantow
│   ├── jobs/
│   │   └── paymentScheduler.ts      # Zadania cykliczne (5 jobow wlacznie z OFAC)
│   ├── lib/
│   │   └── cryptoPayments.ts        # Glowna klasa biblioteki (z OFAC check)
│   ├── middleware/
│   │   ├── apiAuth.ts               # Middleware autoryzacji (legacy)
│   │   └── rateLimit.ts             # Rate limiting
│   ├── services/
│   │   ├── blockchainMonitorService.ts  # Monitoring blockchain
│   │   ├── evmBlockchainService.ts      # Serwis EVM (Alchemy)
│   │   ├── tronBlockchainService.ts     # Serwis Tron (TronGrid)
│   │   ├── ofacService.ts               # Serwis OFAC (SDN list)
│   │   ├── paymentService.ts            # Logika platnosci
│   │   ├── subscriptionService.ts       # Logika subskrypcji
│   │   ├── tenantService.ts             # Logika tenantow
│   │   └── webhookService.ts            # Logika webhookow
│   ├── utils/
│   │   ├── addressValidation.ts     # Walidacja adresow EVM/Tron
│   │   └── encryption.ts           # Szyfrowanie AES-256-GCM, HMAC, podpisy
│   ├── db.ts                        # Polaczenie z baza danych
│   ├── index.ts                     # Punkt wejscia serwera (z inicjalizacja OFAC)
│   ├── routes.ts                    # Definicje endpointow API (wlacznie z OFAC)
│   ├── seed.ts                      # Dane poczatkowe (domyslny tenant, plany)
│   ├── storage.ts                   # Warstwa abstrakcji bazy danych
│   ├── static.ts                    # Serwowanie plikow statycznych
│   └── vite.ts                      # Konfiguracja Vite dev server
│
├── shared/
│   └── schema.ts                    # Schemat bazy (Drizzle ORM) + typy + OFAC tabele
│
├── drizzle.config.ts                # Konfiguracja Drizzle Kit
├── package.json                     # Zaleznosci projektu
├── tailwind.config.ts               # Konfiguracja Tailwind CSS
├── tsconfig.json                    # Konfiguracja TypeScript
└── vite.config.ts                   # Konfiguracja Vite
```

---

## Frontend - Demo UI

### Dostepne strony

| Sciezka | Opis |
|---------|------|
| `/` | Strona glowna |
| `/pay` | Demo interfejs platnosci (4 kroki) |
| `/admin` | Panel administracyjny |

### Przeplyw platnosci (Demo UI) - 4 kroki

1. **Wybor planu**: Wyswietla dostepne plany subskrypcyjne z cenami i funkcjami
2. **Formularz platnosci**: Wybor sieci, tokenu i wpisanie adresu portfela
   - Automatyczne sprawdzanie OFAC z debounce 500ms
   - Ikony statusu: ladowanie (spinner), czysty (zielona tarcza), sankcjonowany (czerwona tarcza)
   - Blokowanie przycisku "Continue" dla sankcjonowanych adresow
   - Alert z pelnym komunikatem OFAC dla sankcjonowanych adresow
3. **Instrukcje platnosci**: QR code z adresem, dokladna kwota, czas wygasniecia
4. **Status**: Automatyczne odswiezanie co 5 sekund, wyswietlanie hash transakcji po potwierdzeniu

---

## Rozwoj i testowanie

### Uruchomienie

```bash
# Zainstaluj zaleznosci
npm install

# Uruchom serwer deweloperski (frontend + backend)
npm run dev

# Zsynchronizuj schemat bazy danych
npm run db:push
```

### Kluczowe pakiety NPM

| Pakiet | Wersja | Zastosowanie |
|--------|--------|--------------|
| `alchemy-sdk` | - | Monitoring blockchain EVM |
| `drizzle-orm` | - | ORM bazy danych |
| `drizzle-kit` | - | Migracje i narzedzia DB |
| `node-cron` | - | Zadania cykliczne |
| `fast-xml-parser` | - | Parsowanie XML OFAC |
| `zod` | - | Walidacja danych |
| `@tanstack/react-query` | v5 | Zarzadzanie stanem serwera |
| `qrcode.react` | - | Generowanie QR code |
| `wouter` | - | Routing React |

### Demo UI

Odwiedz `/pay` aby przetestowac caly przeplyw platnosci z wbudowanym interfejsem demonstracyjnym.

---

## Licencja

MIT

---

Built by [Future and Code](https://futureandcode.com)
