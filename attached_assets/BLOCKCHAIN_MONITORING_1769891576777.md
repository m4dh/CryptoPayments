# Crypto Payments - Blockchain Monitoring

## Przegląd

Dokumentacja systemu monitorowania blockchain dla weryfikacji płatności USDT/USDC.

## Obsługiwane Sieci

| Sieć | Token Standard | Min. Confirmations | Polling Interval |
|------|----------------|-------------------|------------------|
| Arbitrum | ERC-20 | 3 | 30s |
| Ethereum | ERC-20 | 3 | 30s |
| Tron | TRC-20 | 19 | 30s |

## Logika Weryfikacji

### Warunki Akceptacji Płatności

1. **Adres nadawcy** = zarejestrowany adres użytkownika
2. **Adres odbiorcy** = nasz adres z konfiguracji
3. **Token** = wybrany przez użytkownika (USDT lub USDC)
4. **Kwota** >= wymagana kwota planu
5. **Confirmations** >= minimum dla sieci
6. **Timestamp** >= utworzenie płatności

### Diagram Przepływu

```
┌─────────────────────────────────────────────────────────────┐
│  BlockchainMonitorService.startMonitoring()                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  while (queue.length > 0)                                   │
│    │                                                        │
│    ├─ 1. Remove expired payments (> 30 min)                │
│    │     → Update status to 'expired'                       │
│    │                                                        │
│    ├─ 2. For each payment in queue:                        │
│    │     │                                                  │
│    │     ├─ Get recent transfers to receiver address       │
│    │     │                                                  │
│    │     ├─ Filter by:                                     │
│    │     │   - Token contract address                       │
│    │     │   - Sender address (from payment.senderHmac)    │
│    │     │   - Amount >= required                          │
│    │     │   - Timestamp >= payment.createdAt              │
│    │     │                                                  │
│    │     ├─ If found:                                      │
│    │     │   - Check confirmations                          │
│    │     │   - If confirmations >= min:                    │
│    │     │     → handleConfirmedTransaction()              │
│    │     │     → Remove from queue                          │
│    │     │                                                  │
│    │     └─ If not found:                                  │
│    │         → Continue monitoring                          │
│    │                                                        │
│    └─ 3. Sleep 30 seconds                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementacja EVM (Arbitrum/Ethereum)

### Pobieranie Transferów ERC-20

```typescript
// server/services/evmBlockchainService.ts

import { ethers, Contract } from 'ethers';

const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
];

class EvmBlockchainService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();

  constructor() {
    this.providers.set('arbitrum', new ethers.JsonRpcProvider(
      process.env.RPC_ARBITRUM || 'https://arb1.arbitrum.io/rpc'
    ));
    this.providers.set('ethereum', new ethers.JsonRpcProvider(
      process.env.RPC_ETHEREUM || 'https://eth.llamarpc.com'
    ));
  }

  async findTransfer(payment: MonitoredPayment): Promise<TransferResult> {
    const provider = this.providers.get(payment.network);
    if (!provider) throw new Error(`Unknown network: ${payment.network}`);

    const tokenConfig = PAYMENT_NETWORKS[payment.network].tokens[payment.token];
    const tokenContract = new Contract(tokenConfig.address, ERC20_ABI, provider);

    // Pobierz ostatnie bloki (około 30 minut)
    const currentBlock = await provider.getBlockNumber();
    const blocksBack = payment.network === 'arbitrum' ? 7200 : 150; // ~30 min
    const fromBlock = currentBlock - blocksBack;

    // Szukaj eventów Transfer do naszego adresu
    const filter = tokenContract.filters.Transfer(null, payment.receiverAddress);
    const events = await tokenContract.queryFilter(filter, fromBlock, currentBlock);

    // Odszyfruj adres nadawcy z HMAC
    const senderAddress = await this.decryptSenderAddress(payment.senderAddressHmac);

    for (const event of events) {
      const args = event.args;
      if (!args) continue;

      const from = args[0].toLowerCase();
      const to = args[1].toLowerCase();
      const value = args[2];

      // Sprawdź czy to nasz nadawca
      if (from !== senderAddress.toLowerCase()) continue;

      // Sprawdź kwotę
      const decimals = tokenConfig.decimals;
      const amount = ethers.formatUnits(value, decimals);
      const requiredAmount = parseFloat(payment.amount);

      if (parseFloat(amount) < requiredAmount) continue;

      // Sprawdź timestamp
      const block = await provider.getBlock(event.blockNumber);
      if (!block) continue;

      const txTimestamp = new Date(block.timestamp * 1000);
      if (txTimestamp < payment.createdAt) continue;

      // Sprawdź confirmations
      const confirmations = currentBlock - event.blockNumber + 1;

      return {
        found: true,
        txHash: event.transactionHash,
        confirmations,
        amount,
        timestamp: txTimestamp,
      };
    }

    return { found: false };
  }

  async getTransactionConfirmations(
    network: string,
    txHash: string
  ): Promise<number> {
    const provider = this.providers.get(network);
    if (!provider) return 0;

    const tx = await provider.getTransactionReceipt(txHash);
    if (!tx || !tx.blockNumber) return 0;

    const currentBlock = await provider.getBlockNumber();
    return currentBlock - tx.blockNumber + 1;
  }
}
```

## Implementacja Tron

### Pobieranie Transferów TRC-20

```typescript
// server/services/tronBlockchainService.ts

import TronWeb from 'tronweb';

class TronBlockchainService {
  private tronWeb: TronWeb;

  constructor() {
    this.tronWeb = new TronWeb({
      fullHost: process.env.RPC_TRON || 'https://api.trongrid.io',
    });
  }

  async findTransfer(payment: MonitoredPayment): Promise<TransferResult> {
    const tokenConfig = PAYMENT_NETWORKS.tron.tokens[payment.token];
    
    // Odszyfruj adres nadawcy
    const senderAddress = await this.decryptSenderAddress(payment.senderAddressHmac);

    try {
      // TronGrid API - pobierz transfery TRC-20
      const url = `https://api.trongrid.io/v1/accounts/${payment.receiverAddress}/transactions/trc20`;
      const params = {
        only_to: true,
        contract_address: tokenConfig.address,
        min_timestamp: payment.createdAt.getTime(),
        limit: 50,
      };

      const response = await fetch(`${url}?${new URLSearchParams(params as any)}`);
      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        return { found: false };
      }

      for (const tx of data.data) {
        // Sprawdź nadawcę
        if (tx.from.toLowerCase() !== senderAddress.toLowerCase()) continue;

        // Sprawdź kwotę
        const decimals = tokenConfig.decimals;
        const amount = parseFloat(tx.value) / Math.pow(10, decimals);
        const requiredAmount = parseFloat(payment.amount);

        if (amount < requiredAmount) continue;

        // Pobierz confirmations
        const txInfo = await this.tronWeb.trx.getTransactionInfo(tx.transaction_id);
        const confirmations = txInfo.confirmations || 0;

        return {
          found: true,
          txHash: tx.transaction_id,
          confirmations,
          amount: amount.toString(),
          timestamp: new Date(tx.block_timestamp),
        };
      }

      return { found: false };
    } catch (error) {
      console.error('[TronService] Error finding transfer:', error);
      return { found: false };
    }
  }

  async getTransactionConfirmations(txHash: string): Promise<number> {
    try {
      const txInfo = await this.tronWeb.trx.getTransactionInfo(txHash);
      return txInfo.confirmations || 0;
    } catch {
      return 0;
    }
  }
}
```

## Scheduler

### Job Monitoringu

```typescript
// server/jobs/paymentMonitorJob.ts

import cron from 'node-cron';

class PaymentMonitorJob {
  private isRunning = false;

  constructor(
    private paymentRepository: PaymentRepository,
    private blockchainMonitor: BlockchainMonitorService
  ) {}

  start(): void {
    // Co minutę sprawdź czy są nowe płatności do monitorowania
    cron.schedule('* * * * *', async () => {
      await this.checkPendingPayments();
    });

    // Co 5 minut sprawdź wygasłe płatności
    cron.schedule('*/5 * * * *', async () => {
      await this.expireOldPayments();
    });

    console.log('[PaymentMonitorJob] Scheduler started');
  }

  private async checkPendingPayments(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Pobierz płatności awaiting_confirmation, które nie są w kolejce
      const payments = await this.paymentRepository.findByStatus('awaiting_confirmation');
      
      for (const payment of payments) {
        if (!this.blockchainMonitor.isInQueue(payment.id)) {
          this.blockchainMonitor.addToQueue(payment);
        }
      }
    } catch (error) {
      console.error('[PaymentMonitorJob] Error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async expireOldPayments(): Promise<void> {
    const now = new Date();
    
    // Znajdź płatności pending/awaiting_confirmation, które wygasły
    const expiredPayments = await this.paymentRepository.findExpired(now);
    
    for (const payment of expiredPayments) {
      await this.paymentRepository.updateStatus(payment.id, 'expired');
      this.blockchainMonitor.removeFromQueue(payment.id);
      
      console.log(`[PaymentMonitorJob] Payment ${payment.id} expired`);
    }
  }
}
```

## Obsługa Błędów

### Retry Logic

```typescript
class BlockchainMonitorService {
  private retryCount: Map<number, number> = new Map();
  private readonly MAX_RETRIES = 3;

  private async checkPaymentWithRetry(payment: MonitoredPayment): Promise<TransferResult> {
    const retries = this.retryCount.get(payment.id) || 0;

    try {
      const result = await this.checkPayment(payment);
      this.retryCount.delete(payment.id); // Reset on success
      return result;
    } catch (error) {
      if (retries < this.MAX_RETRIES) {
        this.retryCount.set(payment.id, retries + 1);
        console.warn(`[Monitor] Retry ${retries + 1}/${this.MAX_RETRIES} for payment ${payment.id}`);
        return { found: false };
      }
      
      // Max retries exceeded
      console.error(`[Monitor] Max retries exceeded for payment ${payment.id}`, error);
      await this.handleMonitoringFailure(payment.id, error);
      return { found: false };
    }
  }

  private async handleMonitoringFailure(paymentId: number, error: Error): Promise<void> {
    await this.paymentRepository.update(paymentId, {
      status: 'failed',
      errorMessage: `Monitoring failed: ${error.message}`,
    });
    this.removeFromQueue(paymentId);
  }
}
```

### RPC Fallback

```typescript
class EvmBlockchainService {
  private providers: Map<string, ethers.JsonRpcProvider[]> = new Map();

  constructor() {
    // Primary + backup RPCs
    this.providers.set('arbitrum', [
      new ethers.JsonRpcProvider(process.env.RPC_ARBITRUM),
      new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc'),
      new ethers.JsonRpcProvider('https://arbitrum.llamarpc.com'),
    ]);
  }

  private async getWorkingProvider(network: string): Promise<ethers.JsonRpcProvider> {
    const providers = this.providers.get(network) || [];
    
    for (const provider of providers) {
      try {
        await provider.getBlockNumber();
        return provider;
      } catch {
        continue;
      }
    }
    
    throw new Error(`No working RPC for ${network}`);
  }
}
```

## Bezpieczeństwo

### Weryfikacja Transakcji

1. **Nie ufamy użytkownikowi** - weryfikujemy na blockchainie
2. **Sprawdzamy adres nadawcy** - musi być zaszyfrowany w bazie
3. **Sprawdzamy kwotę** - musi być >= wymagana
4. **Sprawdzamy timestamp** - musi być po utworzeniu płatności
5. **Sprawdzamy confirmations** - musi być >= minimum

### Ochrona przed Double-Spending

```typescript
async handleConfirmedTransaction(
  paymentId: number,
  txHash: string,
  confirmations: number
): Promise<void> {
  // Sprawdź czy tx nie została już użyta
  const existingPayment = await this.paymentRepository.findByTxHash(txHash);
  
  if (existingPayment && existingPayment.id !== paymentId) {
    throw new Error(`Transaction ${txHash} already used for payment ${existingPayment.id}`);
  }

  // Atomic update z transaction
  await db.transaction(async (tx) => {
    // Sprawdź jeszcze raz status (optimistic locking)
    const payment = await this.paymentRepository.findById(paymentId, tx);
    
    if (payment.status !== 'awaiting_confirmation') {
      throw new Error(`Payment ${paymentId} is not awaiting confirmation`);
    }

    await this.paymentRepository.update(paymentId, {
      status: 'confirmed',
      txHash,
      confirmations,
      txConfirmedAt: new Date(),
    }, tx);

    await this.subscriptionService.activate(payment.userId, payment.planId, paymentId, tx);
  });
}
```

## Metryki i Logi

### Logging Format

```typescript
// Successful payment
console.log(`[PaymentMonitor] Payment ${paymentId} confirmed: 
  txHash=${txHash}, 
  confirmations=${confirmations}, 
  network=${network}, 
  amount=${amount} ${token}`);

// Expired payment
console.log(`[PaymentMonitor] Payment ${paymentId} expired after 30 minutes`);

// Monitoring error
console.error(`[PaymentMonitor] Error checking payment ${paymentId}: ${error.message}`);
```

### Metryki do Monitoringu

- `payments_pending_count` - liczba płatności w statusie pending
- `payments_awaiting_count` - liczba płatności w monitoringu
- `payments_confirmed_count` - liczba potwierdzonych płatności
- `payments_expired_count` - liczba wygasłych płatności
- `blockchain_rpc_errors` - liczba błędów RPC per sieć
- `payment_confirmation_time_seconds` - czas od confirm do detected
