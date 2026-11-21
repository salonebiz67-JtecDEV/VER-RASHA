import 'dotenv/config';
import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import http from 'http';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { PRODUCTS } from './src/data/catalog.ts';
import type {
  CurrencyCode,
  OrderCustomerInfo,
  OrderLineItem,
  OrderRequestPayload,
  OrderStatus,
  PaymentStatus,
} from './src/types/boutique.ts';
import { formatPrice } from './src/utils/formatCurrency.ts';
import { ORDER_STATUS_LABELS } from './src/utils/orderStatus.ts';
import {
  getAllOrders,
  getNotificationsByCustomer,
  getOrderById,
  getOrdersByCustomer,
  getOwnerCredential,
  hasOrderReference,
  insertNotification,
  insertOrder,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
  sanitizeNotificationForClient,
  sanitizeOrderForClient,
  setOwnerCredentialOnce,
  updateOrderRecord,
  type StoredNotificationRecord,
  type StoredOrderRecord,
} from './server/store.ts';

const PORT = Number(process.env.PORT) || 3000;
const TOKEN_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'CAD', 'AED', 'NGN'];
const OWNER_UPDATABLE_STATUSES: OrderStatus[] = [
  'PROCESSING',
  'READY_FOR_DISPATCH',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];
const VALID_PAYMENT_STATUSES: PaymentStatus[] = [
  'UNPAID',
  'PAYMENT_PENDING',
  'PAID',
  'REFUNDED',
];

interface TokenPayload {
  role: 'customer' | 'owner';
  customerId?: string;
  email?: string;
  exp: number;
}

function signToken(payload: TokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyScryptPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

interface AuthenticatedRequest extends Request {
  customerId?: string;
  ownerEmail?: string;
}

function requireCustomerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Customer session token is required.' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'customer' || !payload.customerId) {
    res.status(401).json({ error: 'Invalid or expired customer session.' });
    return;
  }
  req.customerId = payload.customerId;
  next();
}

function requireOwnerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Owner authentication is required.' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'owner' || !payload.email) {
    res.status(403).json({ error: 'Authenticated boutique owner access is required.' });
    return;
  }
  req.ownerEmail = payload.email;
  next();
}

function cleanRequiredText(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}

function cleanOptionalText(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function generateUniqueOrderReference(): string {
  const now = new Date();
  const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
    now.getUTCDate()
  ).padStart(2, '0')}`;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const candidate = `VR-${datePart}-${suffix}`;
    if (!hasOrderReference(candidate)) {
      return candidate;
    }
  }
  return `VR-${datePart}-${Date.now().toString(36).toUpperCase()}`;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const customerSockets = new Map<string, Set<WebSocket>>();
  const ownerSockets = new Set<WebSocket>();

  function registerCustomerSocket(customerId: string, socket: WebSocket): void {
    let set = customerSockets.get(customerId);
    if (!set) {
      set = new Set();
      customerSockets.set(customerId, set);
    }
    set.add(socket);
  }

  function removeSocket(socket: WebSocket): void {
    ownerSockets.delete(socket);
    for (const [custId, set] of customerSockets.entries()) {
      set.delete(socket);
      if (set.size === 0) {
        customerSockets.delete(custId);
      }
    }
  }

  function sendToCustomer(customerId: string, event: unknown): void {
    const sockets = customerSockets.get(customerId);
    if (!sockets) return;
    const payload = JSON.stringify(event);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  function broadcastToOwners(event: unknown): void {
    const payload = JSON.stringify(event);
    for (const ws of ownerSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  wss.on('connection', (socket) => {
    let authenticated = false;

    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        socket.close(4001, 'Authentication timeout');
      }
    }, 8000);

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; token?: string };
        if (msg.type === 'auth' && typeof msg.token === 'string') {
          const payload = verifyToken(msg.token);
          if (!payload) {
            socket.close(4001, 'Invalid token');
            return;
          }
          authenticated = true;
          clearTimeout(authTimeout);
          if (payload.role === 'owner') {
            ownerSockets.add(socket);
            socket.send(JSON.stringify({ type: 'auth:ok', role: 'owner' }));
          } else if (payload.role === 'customer' && payload.customerId) {
            registerCustomerSocket(payload.customerId, socket);
            socket.send(JSON.stringify({ type: 'auth:ok', role: 'customer' }));
          }
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    socket.on('close', () => {
      clearTimeout(authTimeout);
      removeSocket(socket);
    });

    socket.on('error', () => {
      clearTimeout(authTimeout);
      removeSocket(socket);
    });
  });

  // ---------------------------------------------------------------------------
  // Customer Session
  // ---------------------------------------------------------------------------
  app.post('/api/customer/session', (_req, res) => {
    const customerId = crypto.randomUUID();
    const customerToken = signToken({
      role: 'customer',
      customerId,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ customerToken, customerSessionId: customerId });
  });

  // ---------------------------------------------------------------------------
  // Customer Orders & Notifications (strictly scoped to caller's session)
  // ---------------------------------------------------------------------------
  app.get('/api/orders', requireCustomerAuth, (req: AuthenticatedRequest, res) => {
    const orders = getOrdersByCustomer(req.customerId!).map(sanitizeOrderForClient);
    res.json({ orders });
  });

  app.get('/api/orders/:id', requireCustomerAuth, (req: AuthenticatedRequest, res) => {
    const order = getOrderById(req.params.id);
    if (!order || order.customerSessionId !== req.customerId) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    res.json({ order: sanitizeOrderForClient(order) });
  });

  app.post('/api/orders', requireCustomerAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body as Partial<OrderRequestPayload> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Invalid order request payload.' });
      return;
    }

    const rawCustomer = body.customer;
    if (!rawCustomer || typeof rawCustomer !== 'object') {
      res.status(400).json({ error: 'Customer delivery information is required.' });
      return;
    }

    const fullName = cleanRequiredText(rawCustomer.fullName, 120);
    const phone = cleanRequiredText(rawCustomer.phone, 40);
    const country = cleanRequiredText(rawCustomer.country, 80);
    const city = cleanRequiredText(rawCustomer.city, 80);
    const area = cleanRequiredText(rawCustomer.area, 120);
    const deliveryAddress = cleanRequiredText(rawCustomer.deliveryAddress, 300);
    const deliveryInstructions = cleanOptionalText(rawCustomer.deliveryInstructions, 300);

    if (!fullName || !phone || !country || !city || !area || !deliveryAddress) {
      res.status(400).json({
        error:
          'Please complete all required fields: full name, phone number, country, city, area or neighborhood, and complete delivery address.',
      });
      return;
    }

    if (phone.replace(/\D/g, '').length < 6) {
      res.status(400).json({ error: 'Please enter a valid phone number.' });
      return;
    }

    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
      res.status(400).json({ error: 'Your shopping bag is empty or invalid.' });
      return;
    }

    const verifiedItems: OrderLineItem[] = [];
    let computedSubtotalUsd = 0;

    for (const rawItem of body.items) {
      if (!rawItem || typeof rawItem !== 'object') {
        res.status(400).json({ error: 'Invalid product entry in order request.' });
        return;
      }
      const product = PRODUCTS.find((p) => p.id === rawItem.productId);
      if (!product) {
        res.status(400).json({ error: 'One or more selected products are no longer available.' });
        return;
      }
      if (product.stockStatus === 'out_of_stock') {
        res.status(400).json({ error: `${product.name} is currently out of stock.` });
        return;
      }

      const quantity = Number(rawItem.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        res.status(400).json({ error: `Invalid quantity selected for ${product.name}.` });
        return;
      }

      const selectedSize =
        typeof rawItem.size === 'string' && product.sizes.includes(rawItem.size)
          ? rawItem.size
          : null;
      if (!selectedSize) {
        res.status(400).json({ error: `Invalid size selected for ${product.name}.` });
        return;
      }

      const matchedColor =
        typeof rawItem.colorName === 'string'
          ? product.colors.find((c) => c.name === rawItem.colorName)
          : undefined;
      if (!matchedColor) {
        res.status(400).json({ error: `Invalid colour selected for ${product.name}.` });
        return;
      }

      // Server-authoritative unit price and line total (never trust frontend prices/totals)
      const unitPriceUsd = product.priceUsd;
      const lineTotalUsd = Number((unitPriceUsd * quantity).toFixed(2));
      computedSubtotalUsd = Number((computedSubtotalUsd + lineTotalUsd).toFixed(2));

      verifiedItems.push({
        productId: product.id,
        productName: product.name,
        subtitle: product.subtitle,
        size: selectedSize,
        colorName: matchedColor.name,
        colorHex: matchedColor.hex,
        quantity,
        unitPriceUsd,
        lineTotalUsd,
        image: product.images[0],
      });
    }

    const currency: CurrencyCode =
      typeof body.currency === 'string' && SUPPORTED_CURRENCIES.includes(body.currency as CurrencyCode)
        ? (body.currency as CurrencyCode)
        : 'USD';

    const customerInfo: OrderCustomerInfo = {
      fullName,
      phone,
      country,
      city,
      area,
      deliveryAddress,
      deliveryInstructions,
    };

    const nowIso = new Date().toISOString();
    const storedOrder: StoredOrderRecord = {
      id: crypto.randomUUID(),
      orderReference: generateUniqueOrderReference(),
      customerSessionId: req.customerId!,
      createdAt: nowIso,
      updatedAt: nowIso,
      confirmedAt: null,
      status: 'PENDING_REVIEW',
      paymentStatus: 'UNPAID',
      customer: customerInfo,
      items: verifiedItems,
      currencyAtOrder: currency,
      giftPresentation: Boolean(body.giftPresentation),
      subtotalUsd: computedSubtotalUsd,
      deliveryFeeUsd: null,
      finalTotalUsd: null,
      estimatedDeliveryTime: null,
      ownerMessage: null,
    };

    insertOrder(storedOrder);

    const publicOrder = sanitizeOrderForClient(storedOrder);
    broadcastToOwners({ type: 'owner:order_created', order: publicOrder });

    res.status(201).json({
      status: 'pending_review',
      message:
        'Your order request has been received. Our boutique will review your delivery details and confirm your delivery fee and final total.',
      order: publicOrder,
    });
  });

  app.get('/api/notifications', requireCustomerAuth, (req: AuthenticatedRequest, res) => {
    const notifications = getNotificationsByCustomer(req.customerId!).map(
      sanitizeNotificationForClient
    );
    res.json({ notifications });
  });

  app.post('/api/notifications/:id/read', requireCustomerAuth, (req: AuthenticatedRequest, res) => {
    const ok = markCustomerNotificationRead(req.customerId!, req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireCustomerAuth, (req: AuthenticatedRequest, res) => {
    markAllCustomerNotificationsRead(req.customerId!);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Owner Authentication (Single-Boutique Owner)
  // ---------------------------------------------------------------------------
  app.get('/api/owner/auth-status', (_req, res) => {
    const envConfigured = Boolean(process.env.OWNER_PASSCODE?.trim());
    const claimed = getOwnerCredential() !== null;
    res.json({
      envConfigured,
      claimed,
      needsFirstRunSetup: !envConfigured && !claimed,
    });
  });

  app.post('/api/owner/setup', (req, res) => {
    const envConfigured = Boolean(process.env.OWNER_PASSCODE?.trim());
    if (envConfigured) {
      res.status(409).json({
        error: 'Owner credentials are already configured via environment secrets.',
      });
      return;
    }

    if (getOwnerCredential() !== null) {
      res.status(409).json({
        error: 'Owner workspace has already been claimed. Please sign in.',
      });
      return;
    }

    const body = req.body as { email?: unknown; password?: unknown } | undefined;
    const email = cleanRequiredText(body?.email, 160)?.toLowerCase();
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid owner email address.' });
      return;
    }
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Owner password must be at least 8 characters long.' });
      return;
    }

    const saved = setOwnerCredentialOnce({
      email,
      passwordHash: hashPassword(password),
      claimedAt: new Date().toISOString(),
    });

    if (!saved) {
      res.status(409).json({ error: 'Owner workspace has already been claimed.' });
      return;
    }

    const token = signToken({
      role: 'owner',
      email,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    });

    res.status(201).json({ authenticated: true, email, token });
  });

  app.post('/api/owner/login', (req, res) => {
    const body = req.body as { email?: unknown; password?: unknown } | undefined;
    const emailInput = cleanRequiredText(body?.email, 160)?.toLowerCase() ?? '';
    const passwordInput = typeof body?.password === 'string' ? body.password : '';

    if (!emailInput || !passwordInput) {
      res.status(400).json({ error: 'Please enter both your owner email and password.' });
      return;
    }

    const envPasscode = process.env.OWNER_PASSCODE?.trim();
    const envEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();

    if (envPasscode) {
      const emailOk = envEmail
        ? timingSafeStringEqual(emailInput, envEmail)
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput);
      const passOk = timingSafeStringEqual(passwordInput, envPasscode);

      if (!emailOk || !passOk) {
        res.status(401).json({ error: 'Invalid owner credentials.' });
        return;
      }

      const token = signToken({
        role: 'owner',
        email: envEmail || emailInput,
        exp: Date.now() + 12 * 60 * 60 * 1000,
      });
      res.json({ authenticated: true, email: envEmail || emailInput, token });
      return;
    }

    const stored = getOwnerCredential();
    if (!stored) {
      res.status(400).json({
        error: 'Owner access has not been claimed yet. Complete first-run setup to begin.',
      });
      return;
    }

    const emailMatch = timingSafeStringEqual(emailInput, stored.email.toLowerCase());
    const passMatch = verifyScryptPassword(passwordInput, stored.passwordHash);
    if (!emailMatch || !passMatch) {
      res.status(401).json({ error: 'Invalid owner credentials.' });
      return;
    }

    const token = signToken({
      role: 'owner',
      email: stored.email,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    });
    res.json({ authenticated: true, email: stored.email, token });
  });

  // ---------------------------------------------------------------------------
  // Owner Order Management (Protected by Owner Auth)
  // ---------------------------------------------------------------------------
  app.get('/api/owner/orders', requireOwnerAuth, (_req, res) => {
    const orders = getAllOrders().map(sanitizeOrderForClient);
    res.json({ orders });
  });

  app.post('/api/owner/orders/:id/accept', requireOwnerAuth, (req, res) => {
    const existing = getOrderById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    if (existing.status !== 'PENDING_REVIEW') {
      res.status(400).json({
        error: 'Only orders currently in Pending Review can be accepted with a confirmed fee.',
      });
      return;
    }

    const body = req.body as {
      deliveryFeeUsd?: unknown;
      estimatedDeliveryTime?: unknown;
      ownerMessage?: unknown;
    };

    const deliveryFeeUsd = Number(body?.deliveryFeeUsd);
    if (!Number.isFinite(deliveryFeeUsd) || deliveryFeeUsd < 0 || deliveryFeeUsd > 100000) {
      res.status(400).json({ error: 'Please enter a valid non-negative delivery fee.' });
      return;
    }

    const estimatedDeliveryTime = cleanRequiredText(body?.estimatedDeliveryTime, 120);
    if (!estimatedDeliveryTime) {
      res.status(400).json({ error: 'Please provide an estimated delivery time.' });
      return;
    }

    const ownerMessage = cleanOptionalText(body?.ownerMessage, 500) ?? null;
    const roundedFee = Number(deliveryFeeUsd.toFixed(2));
    // Authoritative server-side calculation: FINAL TOTAL = PRODUCT SUBTOTAL + DELIVERY FEE
    const finalTotalUsd = Number((existing.subtotalUsd + roundedFee).toFixed(2));
    const nowIso = new Date().toISOString();

    const updated = updateOrderRecord(existing.id, (current) => ({
      ...current,
      status: 'CONFIRMED',
      confirmedAt: nowIso,
      updatedAt: nowIso,
      deliveryFeeUsd: roundedFee,
      finalTotalUsd,
      estimatedDeliveryTime,
      ownerMessage,
    }));

    if (!updated) {
      res.status(500).json({ error: 'Failed to update order.' });
      return;
    }

    const formattedFee = formatPrice(roundedFee, updated.currencyAtOrder);
    const formattedTotal = formatPrice(finalTotalUsd, updated.currencyAtOrder);

    const notification: StoredNotificationRecord = {
      id: crypto.randomUUID(),
      customerSessionId: updated.customerSessionId,
      orderId: updated.id,
      orderReference: updated.orderReference,
      type: 'order_update',
      typeLabel: 'Order Confirmed',
      title: `Order ${updated.orderReference} Confirmed`,
      message: `Your order has been accepted by VEY RASHA. Confirmed delivery fee: ${formattedFee}. Final total: ${formattedTotal}. Estimated delivery: ${estimatedDeliveryTime}.${
        ownerMessage ? ` Boutique note: "${ownerMessage}"` : ''
      }`,
      timestamp: nowIso,
      read: false,
      actionRoute: 'account',
      confirmedDeliveryFeeUsd: roundedFee,
      confirmedFinalTotalUsd: finalTotalUsd,
      estimatedDeliveryTime,
      currency: updated.currencyAtOrder,
    };

    insertNotification(notification);

    const publicOrder = sanitizeOrderForClient(updated);
    const publicNotification = sanitizeNotificationForClient(notification);

    sendToCustomer(updated.customerSessionId, {
      type: 'order:updated',
      order: publicOrder,
      notification: publicNotification,
    });
    broadcastToOwners({ type: 'owner:order_updated', order: publicOrder });

    res.json({ order: publicOrder });
  });

  app.patch('/api/owner/orders/:id/status', requireOwnerAuth, (req, res) => {
    const existing = getOrderById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const body = req.body as {
      status?: unknown;
      estimatedDeliveryTime?: unknown;
      ownerMessage?: unknown;
    };

    const nextStatus = body?.status as OrderStatus;
    if (!OWNER_UPDATABLE_STATUSES.includes(nextStatus)) {
      res.status(400).json({ error: 'Invalid target order status.' });
      return;
    }

    if (
      nextStatus !== 'CANCELLED' &&
      (existing.deliveryFeeUsd === null || existing.finalTotalUsd === null)
    ) {
      res.status(400).json({
        error: 'Confirm the delivery fee and accept the order before advancing fulfillment status.',
      });
      return;
    }

    const estimatedDeliveryTime =
      cleanOptionalText(body?.estimatedDeliveryTime, 120) ?? existing.estimatedDeliveryTime;
    const ownerMessage =
      body?.ownerMessage !== undefined
        ? (cleanOptionalText(body.ownerMessage, 500) ?? null)
        : existing.ownerMessage;

    const nowIso = new Date().toISOString();
    const updated = updateOrderRecord(existing.id, (current) => ({
      ...current,
      status: nextStatus,
      updatedAt: nowIso,
      estimatedDeliveryTime,
      ownerMessage,
    }));

    if (!updated) {
      res.status(500).json({ error: 'Failed to update order status.' });
      return;
    }

    const statusLabel = ORDER_STATUS_LABELS[nextStatus];
    const isDeliveryMilestone =
      nextStatus === 'READY_FOR_DISPATCH' ||
      nextStatus === 'SHIPPED' ||
      nextStatus === 'DELIVERED';

    const notification: StoredNotificationRecord = {
      id: crypto.randomUUID(),
      customerSessionId: updated.customerSessionId,
      orderId: updated.id,
      orderReference: updated.orderReference,
      type: isDeliveryMilestone ? 'delivery_update' : 'order_update',
      typeLabel: isDeliveryMilestone ? 'Delivery Update' : 'Order Update',
      title: `Order ${updated.orderReference}: ${statusLabel}`,
      message:
        nextStatus === 'CANCELLED'
          ? `Order ${updated.orderReference} has been marked as Cancelled.${
              ownerMessage ? ` Note: "${ownerMessage}"` : ''
            }`
          : `Order ${updated.orderReference} is now ${statusLabel}.${
              estimatedDeliveryTime ? ` Estimated delivery: ${estimatedDeliveryTime}.` : ''
            }${ownerMessage ? ` Note: "${ownerMessage}"` : ''}`,
      timestamp: nowIso,
      read: false,
      actionRoute: 'account',
      confirmedDeliveryFeeUsd: updated.deliveryFeeUsd ?? undefined,
      confirmedFinalTotalUsd: updated.finalTotalUsd ?? undefined,
      estimatedDeliveryTime: estimatedDeliveryTime ?? undefined,
      currency: updated.currencyAtOrder,
    };

    insertNotification(notification);

    const publicOrder = sanitizeOrderForClient(updated);
    const publicNotification = sanitizeNotificationForClient(notification);

    sendToCustomer(updated.customerSessionId, {
      type: 'order:updated',
      order: publicOrder,
      notification: publicNotification,
    });
    broadcastToOwners({ type: 'owner:order_updated', order: publicOrder });

    res.json({ order: publicOrder });
  });

  app.patch('/api/owner/orders/:id/payment', requireOwnerAuth, (req, res) => {
    const existing = getOrderById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const nextPayment = (req.body as { paymentStatus?: unknown })?.paymentStatus as PaymentStatus;
    if (!VALID_PAYMENT_STATUSES.includes(nextPayment)) {
      res.status(400).json({ error: 'Invalid payment status.' });
      return;
    }

    const updated = updateOrderRecord(existing.id, (current) => ({
      ...current,
      paymentStatus: nextPayment,
      updatedAt: new Date().toISOString(),
    }));

    if (!updated) {
      res.status(500).json({ error: 'Failed to update payment status.' });
      return;
    }

    const publicOrder = sanitizeOrderForClient(updated);
    sendToCustomer(updated.customerSessionId, {
      type: 'order:updated',
      order: publicOrder,
    });
    broadcastToOwners({ type: 'owner:order_updated', order: publicOrder });

    res.json({ order: publicOrder });
  });

  // ---------------------------------------------------------------------------
  // Frontend Serving (Vite Dev Middleware or Built Static Dist)
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`VEY RASHA server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VEY RASHA server:', err);
  process.exit(1);
});
