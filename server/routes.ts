import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Router } from "express";

import { cryptoPayments } from "./lib/cryptoPayments";
import { blockchainMonitorService } from "./services/blockchainMonitorService";
import type { Network, Token } from "@shared/schema";

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

  apiRouter.get('/networks', (req: Request, res: Response) => {
    const networks = cryptoPayments.getNetworks();
    res.json({ networks });
  });

  apiRouter.get('/plans', async (req: Request, res: Response) => {
    try {
      const plans = await cryptoPayments.getPlans();
      res.json({ plans });
    } catch (error) {
      console.error('[API] Error getting plans:', error);
      res.status(500).json({ error: 'Failed to get plans' });
    }
  });

  apiRouter.post('/plans', async (req: Request, res: Response) => {
    try {
      const { planKey, name, description, price, currency, periodDays, features } = req.body;
      
      if (!planKey || !name || !price) {
        return res.status(400).json({ error: 'Missing required fields: planKey, name, price' });
      }

      const plan = await cryptoPayments.createPlan({
        planKey,
        name,
        description,
        price,
        currency,
        periodDays,
        features,
      });

      res.status(201).json(plan);
    } catch (error) {
      console.error('[API] Error creating plan:', error);
      res.status(500).json({ error: 'Failed to create plan' });
    }
  });

  apiRouter.post('/payments', async (req: Request, res: Response) => {
    try {
      const { userId, planId, network, token, senderAddress } = req.body;

      if (!userId || !planId || !network || !token || !senderAddress) {
        return res.status(400).json({ 
          error: 'Missing required fields: userId, planId, network, token, senderAddress' 
        });
      }

      const result = await cryptoPayments.initiatePayment({
        userId,
        planId,
        network: network as Network,
        token: token as Token,
        senderAddress,
      });

      res.status(201).json(result);
    } catch (error: any) {
      console.error('[API] Error initiating payment:', error);
      res.status(400).json({ error: error.message || 'Failed to initiate payment' });
    }
  });

  apiRouter.post('/payments/:id/confirm', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const status = await cryptoPayments.confirmPaymentSent(id);
      res.json(status);
    } catch (error: any) {
      console.error('[API] Error confirming payment:', error);
      res.status(400).json({ error: error.message || 'Failed to confirm payment' });
    }
  });

  apiRouter.get('/payments/:id/status', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const status = await cryptoPayments.getPaymentStatus(id);
      res.json(status);
    } catch (error: any) {
      console.error('[API] Error getting payment status:', error);
      res.status(404).json({ error: error.message || 'Payment not found' });
    }
  });

  apiRouter.get('/payments/history/:userId', async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId as string;
      const limit = parseInt(req.query.limit as string) || 10;
      const payments = await cryptoPayments.getPaymentHistory(userId, limit);
      res.json({ payments });
    } catch (error) {
      console.error('[API] Error getting payment history:', error);
      res.status(500).json({ error: 'Failed to get payment history' });
    }
  });

  apiRouter.delete('/payments/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await cryptoPayments.cancelPayment(id);
      res.json({ success: true, message: 'Payment cancelled' });
    } catch (error: any) {
      console.error('[API] Error cancelling payment:', error);
      res.status(400).json({ error: error.message || 'Failed to cancel payment' });
    }
  });

  apiRouter.post('/validate-address', (req: Request, res: Response) => {
    try {
      const { address, network } = req.body;
      
      if (!address || !network) {
        return res.status(400).json({ error: 'Missing required fields: address, network' });
      }

      const result = cryptoPayments.validateAddress(address, network as Network);
      res.json(result);
    } catch (error) {
      console.error('[API] Error validating address:', error);
      res.status(500).json({ error: 'Failed to validate address' });
    }
  });

  apiRouter.get('/subscriptions/:userId', async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId as string;
      const subscription = await cryptoPayments.getCurrentSubscription(userId);
      res.json({ subscription });
    } catch (error) {
      console.error('[API] Error getting subscription:', error);
      res.status(500).json({ error: 'Failed to get subscription' });
    }
  });

  apiRouter.get('/subscriptions/:userId/history', async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId as string;
      const subscriptions = await cryptoPayments.getSubscriptionHistory(userId);
      res.json({ subscriptions });
    } catch (error) {
      console.error('[API] Error getting subscription history:', error);
      res.status(500).json({ error: 'Failed to get subscription history' });
    }
  });

  app.use('/api', apiRouter);

  blockchainMonitorService.startMonitoring().catch(err => {
    console.error('[Server] Failed to start blockchain monitor:', err);
  });

  return httpServer;
}
