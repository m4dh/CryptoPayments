import type { Express } from "express";
import { createServer, type Server } from "http";
import { Router } from "express";

import { apiKeyAuth } from "./middleware/apiAuth";
import { standardRateLimit, strictRateLimit, pollingRateLimit } from "./middleware/rateLimit";

import * as paymentController from "./controllers/paymentController";
import * as subscriptionController from "./controllers/subscriptionController";
import * as tenantController from "./controllers/tenantController";

import { blockchainMonitorService } from "./services/blockchainMonitorService";
import { tenantService } from "./services/tenantService";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const apiRouter = Router();

  apiRouter.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      monitorQueueSize: blockchainMonitorService.getQueueSize(),
    });
  });

  apiRouter.get('/demo-credentials', async (req, res) => {
    try {
      const credentials = await tenantService.getDemoCredentials();
      if (!credentials) {
        return res.status(404).json({ error: 'NO_DEMO', message: 'Demo tenant not available' });
      }
      res.json(credentials);
    } catch (error) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get demo credentials' });
    }
  });

  apiRouter.get('/tenants', standardRateLimit, tenantController.getAllTenants);
  apiRouter.post('/tenants', strictRateLimit, tenantController.createTenant);

  apiRouter.use(apiKeyAuth);

  apiRouter.get('/tenant', standardRateLimit, tenantController.getTenantInfo);
  apiRouter.patch('/tenant', strictRateLimit, tenantController.updateTenantInfo);
  apiRouter.post('/tenant/regenerate-api-key', strictRateLimit, tenantController.regenerateApiKey);
  apiRouter.post('/tenant/regenerate-webhook-secret', strictRateLimit, tenantController.regenerateWebhookSecret);

  apiRouter.get('/plans', standardRateLimit, tenantController.getPlans);
  apiRouter.post('/plans', strictRateLimit, tenantController.createPlan);
  apiRouter.patch('/plans/:id', strictRateLimit, tenantController.updatePlan);

  apiRouter.get('/payments/plans', standardRateLimit, paymentController.getPlans);
  apiRouter.get('/payments/networks', standardRateLimit, paymentController.getNetworks);
  apiRouter.post('/payments/initiate', strictRateLimit, paymentController.initiatePayment);
  apiRouter.post('/payments/:id/confirm', strictRateLimit, paymentController.confirmPayment);
  apiRouter.get('/payments/:id/status', pollingRateLimit, paymentController.getPaymentStatus);
  apiRouter.get('/payments/history', standardRateLimit, paymentController.getPaymentHistory);
  apiRouter.delete('/payments/:id', strictRateLimit, paymentController.cancelPayment);
  apiRouter.post('/payments/validate-address', standardRateLimit, paymentController.validatePaymentAddress);

  apiRouter.get('/subscriptions/current', standardRateLimit, subscriptionController.getCurrentSubscription);
  apiRouter.get('/subscriptions/history', standardRateLimit, subscriptionController.getSubscriptionHistory);
  apiRouter.get('/subscriptions/active', standardRateLimit, subscriptionController.checkSubscriptionActive);

  app.use('/api', apiRouter);

  blockchainMonitorService.startMonitoring().catch(err => {
    console.error('[Server] Failed to start blockchain monitor:', err);
  });

  return httpServer;
}
