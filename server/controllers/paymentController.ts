import { Request, Response } from 'express';
import { z } from 'zod';
import { paymentService } from '../services/paymentService';
import { validateAddress } from '../utils/addressValidation';
import { getAllNetworks } from '../config/networks';
import { blockchainMonitorService } from '../services/blockchainMonitorService';
import type { Network, Token } from '@shared/schema';

const initiatePaymentSchema = z.object({
  externalUserId: z.string().min(1),
  planId: z.string().min(1),
  network: z.enum(['arbitrum', 'ethereum', 'tron']),
  token: z.enum(['USDT', 'USDC']),
  senderAddress: z.string().min(1),
});

const validateAddressSchema = z.object({
  address: z.string().min(1),
  network: z.enum(['arbitrum', 'ethereum', 'tron']),
});

export async function getPlans(req: Request, res: Response) {
  try {
    const plans = await paymentService.getPlans(req.tenant!.id);
    res.json({ plans });
  } catch (error) {
    console.error('[PaymentController] Error getting plans:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get plans',
    });
  }
}

export async function getNetworks(req: Request, res: Response) {
  try {
    const networks = getAllNetworks().map(n => ({
      id: n.id,
      name: n.name,
      chainId: n.chainId,
      tokens: Object.keys(n.tokens),
      estimatedFee: n.estimatedFee,
      confirmationTime: n.confirmationTime,
      recommended: n.recommended,
    }));
    res.json({ networks });
  } catch (error) {
    console.error('[PaymentController] Error getting networks:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get networks',
    });
  }
}

export async function initiatePayment(req: Request, res: Response) {
  try {
    const parsed = initiatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const { externalUserId, planId, network, token, senderAddress } = parsed.data;

    const result = await paymentService.initiatePayment({
      tenantId: req.tenant!.id,
      externalUserId,
      planId,
      network: network as Network,
      token: token as Token,
      senderAddress,
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PaymentController] Error initiating payment:', message);
    
    if (message.includes('not found') || message.includes('not available')) {
      return res.status(400).json({ error: 'INVALID_PLAN', message });
    }
    if (message.includes('Invalid')) {
      return res.status(400).json({ error: 'INVALID_ADDRESS', message });
    }
    if (message.includes('pending payment')) {
      return res.status(409).json({ error: 'PENDING_EXISTS', message });
    }
    if (message.includes('not configured')) {
      return res.status(400).json({ error: 'INVALID_NETWORK', message });
    }
    
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to initiate payment' });
  }
}

export async function confirmPayment(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await paymentService.confirmPayment(id, req.tenant!.id);
    
    blockchainMonitorService.addToQueue(id);

    res.json({
      success: true,
      message: 'Payment monitoring started',
      status: 'awaiting_confirmation',
      estimatedConfirmationTime: '1-5 minutes',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PaymentController] Error confirming payment:', message);
    
    if (message.includes('not found')) {
      return res.status(404).json({ error: 'NOT_FOUND', message });
    }
    if (message.includes('Unauthorized')) {
      return res.status(403).json({ error: 'FORBIDDEN', message });
    }
    if (message.includes('Cannot confirm') || message.includes('expired')) {
      return res.status(400).json({ error: 'INVALID_STATUS', message });
    }
    
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to confirm payment' });
  }
}

export async function getPaymentStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await paymentService.getPaymentStatus(id, req.tenant!.id);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PaymentController] Error getting payment status:', message);
    
    if (message.includes('not found')) {
      return res.status(404).json({ error: 'NOT_FOUND', message });
    }
    if (message.includes('Unauthorized')) {
      return res.status(403).json({ error: 'FORBIDDEN', message });
    }
    
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get payment status' });
  }
}

export async function getPaymentHistory(req: Request, res: Response) {
  try {
    const { externalUserId } = req.query;
    
    if (!externalUserId || typeof externalUserId !== 'string') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'externalUserId query parameter is required',
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const payments = await paymentService.getPaymentHistory(req.tenant!.id, externalUserId, limit);

    res.json({
      payments: payments.map(p => ({
        id: p.id,
        planId: p.planId,
        amount: p.amount,
        token: p.token,
        network: p.network,
        status: p.status,
        txHash: p.txHash,
        createdAt: p.createdAt,
        confirmedAt: p.txConfirmedAt,
      })),
      total: payments.length,
    });
  } catch (error) {
    console.error('[PaymentController] Error getting payment history:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get payment history' });
  }
}

export async function cancelPayment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await paymentService.cancelPayment(id, req.tenant!.id);
    res.json({ success: true, message: 'Payment cancelled' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PaymentController] Error cancelling payment:', message);
    
    if (message.includes('not found')) {
      return res.status(404).json({ error: 'NOT_FOUND', message });
    }
    if (message.includes('Unauthorized')) {
      return res.status(403).json({ error: 'FORBIDDEN', message });
    }
    if (message.includes('Only pending')) {
      return res.status(400).json({ error: 'CANNOT_CANCEL', message });
    }
    
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to cancel payment' });
  }
}

export async function validatePaymentAddress(req: Request, res: Response) {
  try {
    const parsed = validateAddressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const { address, network } = parsed.data;
    const result = validateAddress(address, network as Network);
    res.json(result);
  } catch (error) {
    console.error('[PaymentController] Error validating address:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to validate address' });
  }
}
