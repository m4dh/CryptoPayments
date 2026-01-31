import { Request, Response, NextFunction } from 'express';
import { tenantService } from '../services/tenantService';
import type { Tenant } from '@shared/schema';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'API key required. Use Authorization: Bearer <api_key>',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid authorization format. Use Authorization: Bearer <api_key>',
    });
  }

  const apiKey = parts[1];

  try {
    const tenant = await tenantService.getTenantByApiKey(apiKey);
    
    if (!tenant) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid API key',
      });
    }

    if (!tenant.isActive) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Tenant account is disabled',
      });
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('[ApiAuth] Error validating API key:', error);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication error',
    });
  }
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Tenant not authenticated',
    });
  }
  next();
}
