import { Request, Response } from 'express';
import { subscriptionService } from '../services/subscriptionService';

export async function getCurrentSubscription(req: Request, res: Response) {
  try {
    const { externalUserId } = req.query;
    
    if (!externalUserId || typeof externalUserId !== 'string') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'externalUserId query parameter is required',
      });
    }

    const result = await subscriptionService.getCurrentSubscription(req.tenant!.id, externalUserId);
    res.json(result);
  } catch (error) {
    console.error('[SubscriptionController] Error getting subscription:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get subscription' });
  }
}

export async function getSubscriptionHistory(req: Request, res: Response) {
  try {
    const { externalUserId } = req.query;
    
    if (!externalUserId || typeof externalUserId !== 'string') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'externalUserId query parameter is required',
      });
    }

    const subscriptions = await subscriptionService.getSubscriptionHistory(req.tenant!.id, externalUserId);
    res.json({
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        planId: s.planId,
        status: s.status,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        paymentId: s.paymentId,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('[SubscriptionController] Error getting subscription history:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get subscription history' });
  }
}

export async function checkSubscriptionActive(req: Request, res: Response) {
  try {
    const { externalUserId } = req.query;
    
    if (!externalUserId || typeof externalUserId !== 'string') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'externalUserId query parameter is required',
      });
    }

    const isActive = await subscriptionService.isSubscriptionActive(req.tenant!.id, externalUserId);
    res.json({ active: isActive });
  } catch (error) {
    console.error('[SubscriptionController] Error checking subscription:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to check subscription' });
  }
}
