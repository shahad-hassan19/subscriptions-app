/**
 * requireAuth.ts — JWT authentication middleware.
 *
 * TypeScript note: jwt.verify returns `string | JwtPayload`. We cast it
 * to our own interface after verifying the shape so downstream code gets
 * full type safety on req.customer.
 */

import jwt                                 from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import config                              from '../config.js';

// Shape of the JWT payload we create in the customer portal login flow
interface SessionPayload {
  type:       string;
  customerId: string;
  email:      string;
  shopId:     string;
  iat?:       number;
  exp?:       number;
}

export function requireAuth(
  req:  Request,
  res:  Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated. Please log in.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as SessionPayload;

    if (decoded.type !== 'session') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    // Attach to req — TypeScript knows this exists because we declared it
    // in the Express namespace augmentation in types/index.ts
    req.customer = {
      id:     decoded.customerId,
      email:  decoded.email,
      shopId: decoded.shopId,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return;
    }
    res.status(401).json({ error: 'Invalid token. Please log in again.' });
  }
}

export default requireAuth;