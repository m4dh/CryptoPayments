import crypto from 'crypto';
import type { WebhookPayload, WebhookEvent } from './types';

export type WebhookHandler = (payload: WebhookPayload) => void | Promise<void>;

export class WebhookVerifier {
  private secret: string;
  private handlers: Map<WebhookEvent | '*', WebhookHandler[]> = new Map();

  constructor(webhookSecret: string) {
    this.secret = webhookSecret;
  }

  verifySignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  parsePayload(body: string, signature: string): WebhookPayload {
    if (!this.verifySignature(body, signature)) {
      throw new WebhookVerificationError('Invalid webhook signature');
    }

    try {
      return JSON.parse(body) as WebhookPayload;
    } catch {
      throw new WebhookVerificationError('Invalid webhook payload');
    }
  }

  on(event: WebhookEvent | '*', handler: WebhookHandler): void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  off(event: WebhookEvent | '*', handler: WebhookHandler): void {
    const handlers = this.handlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  async handleWebhook(body: string, signature: string): Promise<void> {
    const payload = this.parsePayload(body, signature);

    const globalHandlers = this.handlers.get('*') || [];
    const eventHandlers = this.handlers.get(payload.event) || [];

    const allHandlers = [...globalHandlers, ...eventHandlers];

    for (const handler of allHandlers) {
      await handler(payload);
    }
  }

  expressMiddleware() {
    return async (req: any, res: any, next: any) => {
      const signature = req.headers['x-webhook-signature'];
      
      if (!signature) {
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      let body: string;
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        body = req.body.toString('utf8');
      } else {
        body = JSON.stringify(req.body);
      }

      try {
        const payload = this.parsePayload(body, signature);
        req.webhookPayload = payload;
        await this.handleWebhook(body, signature);
        res.status(200).json({ received: true });
      } catch (error) {
        if (error instanceof WebhookVerificationError) {
          return res.status(401).json({ error: error.message });
        }
        next(error);
      }
    };
  }
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}
