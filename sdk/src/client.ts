import type {
  CryptoPaymentSDKConfig,
  NetworkInfo,
  Plan,
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentStatusResult,
  PaymentHistoryItem,
  SubscriptionInfo,
  AddressValidationResult,
  TenantInfo,
  CreatePlanParams,
  ApiError,
  Network,
} from './types';

export class CryptoPaymentSDK {
  private apiKey: string;
  private apiUrl: string;
  private timeout: number;

  constructor(config: CryptoPaymentSDKConfig) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.apiUrl}/api${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        const error = data as ApiError;
        throw new CryptoPaymentError(
          error.message || 'Request failed',
          error.error || 'UNKNOWN_ERROR',
          response.status
        );
      }

      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  get tenant() {
    return {
      getInfo: () => this.request<TenantInfo>('GET', '/tenant'),
      update: (data: Partial<TenantInfo>) => 
        this.request<TenantInfo>('PATCH', '/tenant', data),
      regenerateApiKey: () => 
        this.request<{ apiKey: string }>('POST', '/tenant/regenerate-api-key'),
      regenerateWebhookSecret: () => 
        this.request<{ webhookSecret: string }>('POST', '/tenant/regenerate-webhook-secret'),
    };
  }

  get plans() {
    return {
      list: () => 
        this.request<{ plans: Plan[] }>('GET', '/plans').then(r => r.plans),
      create: (params: CreatePlanParams) => 
        this.request<Plan>('POST', '/plans', params),
      update: (id: string, data: Partial<Plan>) => 
        this.request<Plan>('PATCH', `/plans/${id}`, data),
    };
  }

  get payments() {
    return {
      getNetworks: () => 
        this.request<{ networks: NetworkInfo[] }>('GET', '/payments/networks').then(r => r.networks),
      
      getPlans: () => 
        this.request<{ plans: Plan[] }>('GET', '/payments/plans').then(r => r.plans),
      
      initiate: (params: InitiatePaymentParams) => 
        this.request<InitiatePaymentResult>('POST', '/payments/initiate', params),
      
      confirm: (paymentId: string) => 
        this.request<{ success: boolean; status: string }>('POST', `/payments/${paymentId}/confirm`),
      
      getStatus: (paymentId: string) => 
        this.request<PaymentStatusResult>('GET', `/payments/${paymentId}/status`),
      
      getHistory: (externalUserId: string, limit?: number) => 
        this.request<{ payments: PaymentHistoryItem[] }>(
          'GET', 
          `/payments/history?externalUserId=${encodeURIComponent(externalUserId)}${limit ? `&limit=${limit}` : ''}`
        ).then(r => r.payments),
      
      cancel: (paymentId: string) => 
        this.request<{ success: boolean }>('DELETE', `/payments/${paymentId}`),
      
      validateAddress: (address: string, network: Network) => 
        this.request<AddressValidationResult>('POST', '/payments/validate-address', { address, network }),
    };
  }

  get subscriptions() {
    return {
      getCurrent: (externalUserId: string) => 
        this.request<SubscriptionInfo>('GET', `/subscriptions/current?externalUserId=${encodeURIComponent(externalUserId)}`),
      
      getHistory: (externalUserId: string) => 
        this.request<{ subscriptions: any[] }>('GET', `/subscriptions/history?externalUserId=${encodeURIComponent(externalUserId)}`).then(r => r.subscriptions),
      
      isActive: (externalUserId: string) => 
        this.request<{ active: boolean }>('GET', `/subscriptions/active?externalUserId=${encodeURIComponent(externalUserId)}`).then(r => r.active),
    };
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('GET', '/health');
  }
}

export class CryptoPaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'CryptoPaymentError';
  }
}
