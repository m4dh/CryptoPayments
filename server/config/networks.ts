import type { Network, Token, NetworkConfig } from "@shared/schema";

export const PAYMENT_NETWORKS: Record<Network, NetworkConfig> = {
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum One',
    chainId: 42161,
    tokens: {
      USDT: {
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        decimals: 6,
        name: 'Tether USD',
      },
      USDC: {
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        decimals: 6,
        name: 'USD Coin',
      },
    },
    minConfirmations: 3,
    estimatedFee: '$0.01',
    confirmationTime: '~1 minute',
    recommended: true,
    explorerUrl: 'https://arbiscan.io',
    explorerTxPath: '/tx/',
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    tokens: {
      USDT: {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
        name: 'Tether USD',
      },
      USDC: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
        name: 'USD Coin',
      },
    },
    minConfirmations: 3,
    estimatedFee: '$2-5',
    confirmationTime: '~5 minutes',
    recommended: false,
    explorerUrl: 'https://etherscan.io',
    explorerTxPath: '/tx/',
  },
  tron: {
    id: 'tron',
    name: 'Tron',
    tokens: {
      USDT: {
        address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        decimals: 6,
        name: 'Tether USD',
      },
      USDC: {
        address: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
        decimals: 6,
        name: 'USD Coin',
      },
    },
    minConfirmations: 19,
    estimatedFee: '$0.50',
    confirmationTime: '~3 minutes',
    recommended: false,
    explorerUrl: 'https://tronscan.org',
    explorerTxPath: '/#/transaction/',
  },
};

export const PAYMENT_TIMEOUT_MINUTES = 30;
export const POLLING_INTERVAL_MS = 30000;
export const MAX_RETRY_COUNT = 3;
export const WEBHOOK_RETRY_DELAYS = [60, 300, 900, 3600];

export function getNetworkConfig(network: Network): NetworkConfig {
  return PAYMENT_NETWORKS[network];
}

export function getTokenConfig(network: Network, token: Token) {
  return PAYMENT_NETWORKS[network].tokens[token];
}

export function getTxExplorerUrl(network: Network, txHash: string): string {
  const config = PAYMENT_NETWORKS[network];
  return `${config.explorerUrl}${config.explorerTxPath}${txHash}`;
}

export function isEvmNetwork(network: Network): boolean {
  return network === 'arbitrum' || network === 'ethereum';
}

export function getAllNetworks(): NetworkConfig[] {
  return Object.values(PAYMENT_NETWORKS);
}

export function getSupportedTokens(): Token[] {
  return ['USDT', 'USDC'];
}
