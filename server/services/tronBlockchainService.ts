import { getTokenConfig, getNetworkConfig } from "../config/networks";
import { decryptAddress } from "../utils/encryption";
import type { Payment, Token } from "@shared/schema";

export interface TransferResult {
  found: boolean;
  txHash?: string;
  confirmations?: number;
  amount?: string;
  timestamp?: Date;
}

const TRONGRID_API_URL = process.env.RPC_TRON || 'https://api.trongrid.io';

class TronBlockchainService {
  private apiKey?: string;

  constructor() {
    this.apiKey = process.env.TRONGRID_API_KEY;
  }

  async findTransfer(payment: Payment): Promise<TransferResult> {
    try {
      const senderAddress = decryptAddress(payment.senderAddressEncrypted);
      const tokenConfig = getTokenConfig('tron', payment.token as Token);
      const networkConfig = getNetworkConfig('tron');

      const url = new URL(`${TRONGRID_API_URL}/v1/accounts/${payment.receiverAddress}/transactions/trc20`);
      url.searchParams.set('only_to', 'true');
      url.searchParams.set('contract_address', tokenConfig.address);
      url.searchParams.set('min_timestamp', payment.createdAt.getTime().toString());
      url.searchParams.set('limit', '50');
      url.searchParams.set('order_by', 'block_timestamp,desc');

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (this.apiKey) {
        headers['TRON-PRO-API-KEY'] = this.apiKey;
      }

      const response = await fetch(url.toString(), { headers });
      if (!response.ok) {
        console.error(`[TronService] API error: ${response.status}`);
        return { found: false };
      }

      const data = await response.json();
      if (!data.data || data.data.length === 0) {
        return { found: false };
      }

      const requiredAmount = parseFloat(payment.amount);

      for (const tx of data.data) {
        if (tx.from.toLowerCase() !== senderAddress.toLowerCase()) continue;

        const transferAmount = parseFloat(tx.value) / Math.pow(10, tokenConfig.decimals);
        if (transferAmount < requiredAmount * 0.99) continue;

        const confirmations = await this.getTransactionConfirmations(tx.transaction_id);
        if (confirmations >= networkConfig.minConfirmations) {
          return {
            found: true,
            txHash: tx.transaction_id,
            confirmations,
            amount: transferAmount.toString(),
            timestamp: new Date(tx.block_timestamp),
          };
        }
      }

      return { found: false };
    } catch (error) {
      console.error(`[TronService] Error finding transfer for payment ${payment.id}:`, error);
      return { found: false };
    }
  }

  async getTransactionConfirmations(txHash: string): Promise<number> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['TRON-PRO-API-KEY'] = this.apiKey;
      }

      const response = await fetch(`${TRONGRID_API_URL}/wallet/gettransactioninfobyid`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ value: txHash }),
      });

      if (!response.ok) {
        console.error(`[TronService] Error getting tx info: ${response.status}`);
        return 0;
      }

      const data = await response.json();
      
      if (!data.blockNumber) return 0;

      const currentBlock = await this.getCurrentBlockNumber();
      return Math.max(0, currentBlock - data.blockNumber);
    } catch (error) {
      console.error(`[TronService] Error getting confirmations for ${txHash}:`, error);
      return 0;
    }
  }

  async getCurrentBlockNumber(): Promise<number> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (this.apiKey) {
        headers['TRON-PRO-API-KEY'] = this.apiKey;
      }

      const response = await fetch(`${TRONGRID_API_URL}/wallet/getnowblock`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) return 0;

      const data = await response.json();
      return data.block_header?.raw_data?.number || 0;
    } catch (error) {
      console.error('[TronService] Error getting block number:', error);
      return 0;
    }
  }

  isAvailable(): boolean {
    return true;
  }
}

export const tronBlockchainService = new TronBlockchainService();
