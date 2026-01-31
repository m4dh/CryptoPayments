import { Alchemy, Network as AlchemyNetwork, AssetTransfersCategory } from "alchemy-sdk";
import { getNetworkConfig, getTokenConfig } from "../config/networks";
import { decryptAddress } from "../utils/encryption";
import type { Payment, Network, Token } from "@shared/schema";

export interface TransferResult {
  found: boolean;
  txHash?: string;
  confirmations?: number;
  amount?: string;
  timestamp?: Date;
  blockNumber?: number;
}

const ALCHEMY_NETWORKS: Record<string, AlchemyNetwork> = {
  arbitrum: AlchemyNetwork.ARB_MAINNET,
  ethereum: AlchemyNetwork.ETH_MAINNET,
};

class EvmBlockchainService {
  private alchemyClients: Map<string, Alchemy> = new Map();

  constructor() {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      console.warn('[EvmService] ALCHEMY_API_KEY not set, blockchain monitoring will be disabled');
      return;
    }

    for (const [networkId, alchemyNetwork] of Object.entries(ALCHEMY_NETWORKS)) {
      this.alchemyClients.set(networkId, new Alchemy({
        apiKey,
        network: alchemyNetwork,
      }));
    }
  }

  private getClient(network: Network): Alchemy | null {
    return this.alchemyClients.get(network) || null;
  }

  async findTransfer(payment: Payment): Promise<TransferResult> {
    const network = payment.network as Network;
    const client = this.getClient(network);
    
    if (!client) {
      console.warn(`[EvmService] No client available for network ${network}`);
      return { found: false };
    }

    try {
      const senderAddress = decryptAddress(payment.senderAddressEncrypted);
      const tokenConfig = getTokenConfig(network, payment.token as Token);
      const networkConfig = getNetworkConfig(network);

      const transfers = await client.core.getAssetTransfers({
        fromAddress: senderAddress,
        toAddress: payment.receiverAddress,
        contractAddresses: [tokenConfig.address],
        category: [AssetTransfersCategory.ERC20],
        withMetadata: true,
        order: "desc",
        maxCount: 50,
      });

      const requiredAmount = parseFloat(payment.amount);
      const paymentCreatedAt = payment.createdAt.getTime();

      for (const transfer of transfers.transfers) {
        if (!transfer.blockNum || !transfer.hash) continue;

        const blockTimestamp = transfer.metadata?.blockTimestamp;
        if (blockTimestamp) {
          const txTime = new Date(blockTimestamp).getTime();
          if (txTime < paymentCreatedAt) continue;
        }

        const transferAmount = transfer.value || 0;
        if (transferAmount < requiredAmount * 0.99) continue;

        const currentBlock = await client.core.getBlockNumber();
        const txBlockNumber = parseInt(transfer.blockNum, 16);
        const confirmations = currentBlock - txBlockNumber + 1;

        if (confirmations >= networkConfig.minConfirmations) {
          return {
            found: true,
            txHash: transfer.hash,
            confirmations,
            amount: transferAmount.toString(),
            timestamp: blockTimestamp ? new Date(blockTimestamp) : new Date(),
            blockNumber: txBlockNumber,
          };
        }
      }

      return { found: false };
    } catch (error) {
      console.error(`[EvmService] Error finding transfer for payment ${payment.id}:`, error);
      return { found: false };
    }
  }

  async getTransactionConfirmations(network: Network, txHash: string): Promise<number> {
    const client = this.getClient(network);
    if (!client) return 0;

    try {
      const tx = await client.core.getTransactionReceipt(txHash);
      if (!tx || !tx.blockNumber) return 0;

      const currentBlock = await client.core.getBlockNumber();
      return currentBlock - tx.blockNumber + 1;
    } catch (error) {
      console.error(`[EvmService] Error getting confirmations for ${txHash}:`, error);
      return 0;
    }
  }

  async getCurrentBlockNumber(network: Network): Promise<number> {
    const client = this.getClient(network);
    if (!client) return 0;

    try {
      return await client.core.getBlockNumber();
    } catch (error) {
      console.error(`[EvmService] Error getting block number for ${network}:`, error);
      return 0;
    }
  }

  isAvailable(network: Network): boolean {
    return this.alchemyClients.has(network);
  }
}

export const evmBlockchainService = new EvmBlockchainService();
