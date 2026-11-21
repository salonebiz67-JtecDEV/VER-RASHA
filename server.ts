import 'dotenv/config';
import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  CategorySlug,
  CurrencyCode,
  OrderCustomerInfo,
  OrderLineItem,
  OrderRequestPayload,
  OrderStatus,
  PaymentStatus,
  Product,
  StockStatus,
} from './src/types/boutique.ts';
import { formatPrice } from './src/utils/formatCurrency.ts';
import { ORDER_STATUS_LABELS } from './src/utils/orderStatus.ts';
import {
  addBoutiqueAnnouncement,
  addProductRecord,
  authorizeCustomerForOrder,
  deleteProductRecord,
  emergencyRecoverOwnerSlots,
  enrollOwnerDeviceAtomic,
  findActiveDeviceByToken,
  getAllOrders,
  getCatalogState,
  getNotificationsByCustomer,
  getOrderById,
  getOrderByReference,
  getOrdersByCustomer,
  getOwnerSecuritySummary,
  getProductById,
  hasOrderReference,
  insertNotification,
  insertOrder,
  isCustomerAuthorizedForOrder,
  issueOwnerReplacementCode,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
  recordOwnerSecurityAudit,
  revokeOwnerDevice,
  rotateOwnerDeviceToken,
  sanitizeDeviceForClient,
  sanitizeNotificationForClient,
  sanitizeOrderForClient,
  sha256Hex,
  syncStoreIfExternallyModified,
  timingSafeHexEqual,
  updateCampaignRecord,
  updateCollectionRecord,
  updateOrderRecord,
  updateProductRecord,
  updateStoreSettingsRecord,
  type StoredNotificationRecord,
  type StoredOrderRecord,
  type StoredOwnerDevice,
} from './server/store.ts';

const PORT = Number(process.env.PORT) || 3000;
const TOKEN_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const OWNER_COOKIE_NAME = 'vr_owner_session';

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>([
    'capacitor://localhost',
    'http://localhost',
    'https://localhost',
  ]);

  const rawList = [process.env.FRONTEND_URL, process.env.APP_URL]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .flatMap((v) => v.split(','));

  for (const candidate of rawList) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    try {
      origins.add(new URL(trimmed).origin.toLowerCase());
    } catch {
      // Ignore malformed origin string
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
  }

  return origins;
}

const ALLOWED_ORIGINS = buildAllowedOrigins();

function isOriginAllowed(origin: string | undefined, req: http.IncomingMessage): boolean {
  if (!origin) return false;
  let normalizedOrigin: string;
  let parsedOriginHost: string;
  try {
    const parsed = new URL(origin);
    normalizedOrigin = parsed.origin.toLowerCase();
    parsedOriginHost = parsed.host.toLowerCase();
  } catch {
    return false;
  }

  if (ALLOWED_ORIGINS.has(normalizedOrigin)) {
    return true;
  }

  const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '')
    .toString()
    .split(',')[0]
    .trim()
    .toLowerCase();

  return Boolean(expectedHost && parsedOriginHost === expectedHost);
}

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'CAD', 'AED', 'NGN'];
const VALID_CATEGORIES: Exclude<CategorySlug, 'all'>[] = [
  'dresses',
  'tailoring',
  'outerwear',
  'separates',
  'handbags',
  'jewellery',
];
const CATEGORY_LABELS: Record<Exclude<CategorySlug, 'all'>, string> = {
  dresses: 'Silk Dresses',
  tailoring: 'Tailoring',
  outerwear: 'Outerwear',
  separates: 'Separates',
  handbags: 'Leather Goods',
  jewellery: 'Fine Jewellery',
};

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

interface CustomerTokenPayload {
  role: 'customer';
  customerId: string;
  exp: number;
}

function signCustomerToken(payload: CustomerTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyCustomerToken(token: string): CustomerTokenPayload | null {
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
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as CustomerTokenPayload;
    if (
      !payload ||
      payload.role !== 'customer' ||
      !payload.customerId ||
      typeof payload.exp !== 'number' ||
      payload.exp < Date.now()
    ) {
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

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return false;
}

function setOwnerSessionCookie(req: Request, res: Response, rawToken: string): void {
  const maxAge = 30 * 24 * 60 * 60;
  const encoded = encodeURIComponent(rawToken);
  if (isHttpsRequest(req)) {
    res.setHeader(
      'Set-Cookie',
      `${OWNER_COOKIE_NAME}=${encoded}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${maxAge}`
    );
  } else {
    res.setHeader(
      'Set-Cookie',
      `${OWNER_COOKIE_NAME}=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
    );
  }
}

function clearOwnerSessionCookie(req: Request, res: Response): void {
  if (isHttpsRequest(req)) {
    res.setHeader(
      'Set-Cookie',
      `${OWNER_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    );
  } else {
    res.setHeader(
      'Set-Cookie',
      `${OWNER_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    );
  }
}

function isValidSameOriginOrCustomHeader(req: Request): boolean {
  if (req.headers['x-requested-with'] === 'VEYRASHA-Client') {
    return true;
  }
  return isOriginAllowed(req.headers.origin, req);
}

function hashUa(req: http.IncomingMessage): string {
  const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
  return sha256Hex(ua);
}

function hashIp(req: Request): string {
  return sha256Hex(req.ip || 'unknown').slice(0, 16);
}

function verifyDeviceKeyProof(
  req: Request,
  device: StoredOwnerDevice
): { ok: true } | { ok: false; reason: string } {
  const reqDeviceId =
    typeof req.headers['x-device-id'] === 'string' ? req.headers['x-device-id'].trim() : '';

  if (!reqDeviceId || reqDeviceId !== device.deviceId) {
    return { ok: false, reason: 'Device identifier mismatch' };
  }

  if (device.publicKeyJwk) {
    const tsRaw =
      typeof req.headers['x-device-timestamp'] === 'string'
        ? req.headers['x-device-timestamp'].trim()
        : '';
    const sigB64Url =
      typeof req.headers['x-device-signature'] === 'string'
        ? req.headers['x-device-signature'].trim()
        : '';

    const ts = Number(tsRaw);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 120_000 || !sigB64Url) {
      return { ok: false, reason: 'Missing or expired device cryptographic proof' };
    }

    try {
      const publicKey = crypto.createPublicKey({
        key: device.publicKeyJwk as crypto.JsonWebKey,
        format: 'jwk',
      });
      const signedPayload = `${req.method.toUpperCase()}:${req.path}:${tsRaw}:${device.deviceId}`;
      const sigBuf = Buffer.from(sigB64Url, 'base64url');
      const dsaEncoding = sigBuf.length === 64 ? 'ieee-p1363' : 'der';
      const verified = crypto.verify(
        'sha256',
        Buffer.from(signedPayload, 'utf8'),
        { key: publicKey, dsaEncoding },
        sigBuf
      );
      if (!verified) {
        return { ok: false, reason: 'Invalid device key signature' };
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: 'Failed to verify device signature' };
    }
  }

  // Fallback binding for browsers without WebCrypto SubtleCrypto: enforce User-Agent digest
  if (device.uaHash && hashUa(req) !== device.uaHash) {
    return { ok: false, reason: 'Device browser binding mismatch' };
  }
  return { ok: true };
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

interface AuthenticatedRequest extends Request {
  customerId?: string;
  ownerDevice?: StoredOwnerDevice;
  ownerUsedCookie?: boolean;
}

function requireCustomerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Customer session token is required.' });
    return;
  }
  const payload = verifyCustomerToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired customer session.' });
    return;
  }
  req.customerId = payload.customerId;
  next();
}

function resolveOwnerAuth(req: AuthenticatedRequest): {
  device: StoredOwnerDevice | null;
  usedCookie: boolean;
  failureReason?: string;
} {
  syncStoreIfExternallyModified();

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[OWNER_COOKIE_NAME] || '';
  const bearerToken = extractBearerToken(req) || '';

  const rawToken = bearerToken || cookieToken;
  const usedCookie = !bearerToken && Boolean(cookieToken);

  if (!rawToken) {
    return { device: null, usedCookie, failureReason: 'No owner device token supplied' };
  }

  const reqDeviceId =
    typeof req.headers['x-device-id'] === 'string' ? req.headers['x-device-id'].trim() : '';
  const device = findActiveDeviceByToken(rawToken, reqDeviceId || null);
  if (!device) {
    return { device: null, usedCookie, failureReason: 'Unknown or revoked owner device token' };
  }

  const bindingCheck = verifyDeviceKeyProof(req, device);
  if (!bindingCheck.ok) {
    return { device: null, usedCookie, failureReason: bindingCheck.reason };
  }

  return { device, usedCookie };
}

function requireOwnerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
  const { device, usedCookie, failureReason } = resolveOwnerAuth(req);

  if (usedCookie && isMutation && !isValidSameOriginOrCustomHeader(req)) {
    recordOwnerSecurityAudit('AUTH_FAILURE', 'Rejected cross-site mutation without origin match.', {
      ipHash: hashIp(req),
    });
    res.status(403).json({ error: 'Forbidden.' });
    return;
  }

  if (!device) {
    if (failureReason !== 'No owner device token supplied') {
      recordOwnerSecurityAudit('AUTH_FAILURE', failureReason || 'Unauthorized dashboard attempt', {
        deviceId:
          typeof req.headers['x-device-id'] === 'string'
            ? req.headers['x-device-id'].slice(0, 64)
            : undefined,
        ipHash: hashIp(req),
      });
    }
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  req.ownerDevice = device;
  req.ownerUsedCookie = usedCookie;
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

function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function computeStockStatus(stockCount: number): StockStatus {
  if (stockCount <= 0) return 'out_of_stock';
  if (stockCount <= 3) return 'low_stock';
  return 'in_stock';
}

function isValidPublicKeyJwk(value: unknown): value is JsonWebKey {
  if (!value || typeof value !== 'object') return false;
  const jwk = value as JsonWebKey;
  return jwk.kty === 'EC' && jwk.crv === 'P-256' && typeof jwk.x === 'string' && typeof jwk.y === 'string';
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
  app.set('trust proxy', 1);

  // Explicit CORS configuration for cross-origin GitHub Pages -> Render API calls
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.setHeader('Vary', 'Origin');

    if (origin) {
      if (isOriginAllowed(origin, req)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, X-Requested-With, X-Device-Id, X-Device-Timestamp, X-Device-Signature, X-Owner-Recovery-Secret'
        );
        res.setHeader('Access-Control-Max-Age', '86400');

        if (req.method === 'OPTIONS') {
          res.status(204).end();
          return;
        }
      } else if (req.method === 'OPTIONS') {
        res.status(403).json({ error: 'Origin not allowed.' });
        return;
      }
    }

    next();
  });

  app.use(express.json({ limit: '512kb' }));

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const customerSockets = new Map<string, Set<WebSocket>>();
  const ownerSockets = new Map<WebSocket, { slot: 1 | 2 }>();

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

  function broadcastToAllCustomers(event: unknown): void {
    const payload = JSON.stringify(event);
    for (const sockets of customerSockets.values()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  }

  function sendToOrderSubscribers(order: StoredOrderRecord, event: unknown): void {
    const targets = new Set<string>([
      order.customerSessionId,
      ...(order.authorizedCustomerSessionIds ?? []),
    ]);
    for (const cid of targets) {
      sendToCustomer(cid, event);
    }
  }

  function broadcastToOwners(event: unknown): void {
    const payload = JSON.stringify(event);
    for (const ws of ownerSockets.keys()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  function disconnectRevokedOwnerSlot(slot: 1 | 2): void {
    for (const [ws, meta] of ownerSockets.entries()) {
      if (meta.slot === slot) {
        ownerSockets.delete(ws);
        try {
          ws.close(4003, 'Device access revoked');
        } catch {
          // Ignore close error
        }
      }
    }
  }

  wss.on('connection', (socket, req) => {
    if (
      process.env.NODE_ENV === 'production' &&
      req.headers.origin &&
      !isOriginAllowed(req.headers.origin, req)
    ) {
      socket.close(4003, 'Origin not allowed');
      return;
    }

    let authenticated = false;

    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        socket.close(4001, 'Authentication timeout');
      }
    }, 8000);

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          role?: string;
          token?: string;
          deviceId?: string;
        };

        if (msg.type === 'auth') {
          if (msg.role === 'owner') {
            syncStoreIfExternallyModified();
            const cookies = parseCookies(req.headers.cookie);
            const cookieToken = cookies[OWNER_COOKIE_NAME] || '';
            const candidateToken = (typeof msg.token === 'string' && msg.token) || cookieToken;
            const deviceId = typeof msg.deviceId === 'string' ? msg.deviceId.trim() : '';

            if (!candidateToken || !deviceId) {
              socket.close(4001, 'Unauthorized');
              return;
            }
            const device = findActiveDeviceByToken(candidateToken, deviceId);
            if (!device) {
              socket.close(4001, 'Invalid or revoked device');
              return;
            }

            authenticated = true;
            clearTimeout(authTimeout);
            ownerSockets.set(socket, { slot: device.slot });
            socket.send(JSON.stringify({ type: 'auth:ok', role: 'owner', slot: device.slot }));
            return;
          }

          if (typeof msg.token === 'string') {
            const payload = verifyCustomerToken(msg.token);
            if (!payload) {
              socket.close(4001, 'Invalid token');
              return;
            }
            authenticated = true;
            clearTimeout(authTimeout);
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
  // Health Check & Public Catalog
  // ---------------------------------------------------------------------------
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'vey-rasha-api',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.get('/api/catalog', (_req, res) => {
    syncStoreIfExternallyModified();
    const catalog = getCatalogState();
    res.json(catalog);
  });

  // ---------------------------------------------------------------------------
  // Customer Session
  // ---------------------------------------------------------------------------
  app.post('/api/customer/session', (_req, res) => {
    const customerId = crypto.randomUUID();
    const customerToken = signCustomerToken({
      role: 'customer',
      customerId,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ customerToken, customerSessionId: customerId });
  });

  // ---------------------------------------------------------------------------
  // Customer Orders & Notifications (strictly scoped to caller's session)
  // ---------------------------------------------------------------------------
  const retrieveAttempts = new Map<string, { count: number; resetAt: number }>();

  app.get('/api/orders', requireCustomerAuth, (req: AuthenticatedRequest, res) => {
    syncStoreIfExternallyModified();
    const orders = getOrdersByCustomer(req.customerId!).map(sanitizeOrderForClient);
    res.json({ orders });
  });

  app.post('/api/orders/retrieve', requireCustomerAuth, (req: AuthenticatedRequest, res) => {
    syncStoreIfExternallyModified();
    const rateKey = req.ip || req.customerId || 'unknown';
    const now = Date.now();
    const record = retrieveAttempts.get(rateKey);
    if (record && record.resetAt > now && record.count >= 8) {
      res.status(429).json({
        error: 'Too many verification attempts. Please wait a few minutes before trying again.',
      });
      return;
    }

    const body = req.body as { orderReference?: unknown; phone?: unknown } | undefined;
    const orderReference = cleanRequiredText(body?.orderReference, 40);
    const phoneInput = cleanRequiredText(body?.phone, 40);
    const normalizedInputDigits = phoneInput ? phoneInput.replace(/\D/g, '') : '';

    if (!orderReference || normalizedInputDigits.length < 6) {
      res.status(400).json({
        error: 'Please enter both your order reference and the phone number used at checkout.',
      });
      return;
    }

    const found = getOrderByReference(orderReference);
    const storedDigits = found ? found.customer.phone.replace(/\D/g, '') : '';
    const phoneMatches = Boolean(
      found && storedDigits.length >= 6 && timingSafeStringEqual(normalizedInputDigits, storedDigits)
    );

    if (!found || !phoneMatches) {
      const nextCount = record && record.resetAt > now ? record.count + 1 : 1;
      const nextResetAt = record && record.resetAt > now ? record.resetAt : now + 10 * 60 * 1000;
      retrieveAttempts.set(rateKey, { count: nextCount, resetAt: nextResetAt });
      res.status(404).json({
        error: 'No matching order found. Please check your order reference and phone number.',
      });
      return;
    }

    retrieveAttempts.delete(rateKey);
    const authorizedOrder = authorizeCustomerForOrder(found.id, req.customerId!) ?? found;
    const notifications = getNotificationsByCustomer(req.customerId!).map(
      sanitizeNotificationForClient
    );

    res.json({
      order: sanitizeOrderForClient(authorizedOrder),
      notifications,
    });
  });

  app.get('/api/orders/:id', requireCustomerAuth, (req: AuthenticatedRequest, res) => {
    syncStoreIfExternallyModified();
    const order = getOrderById(req.params.id);
    if (!order || !isCustomerAuthorizedForOrder(order, req.customerId!)) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    res.json({ order: sanitizeOrderForClient(order) });
  });

  app.post('/api/orders', requireCustomerAuth, (req: AuthenticatedRequest, res) => {
    syncStoreIfExternallyModified();
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
      const product = getProductById(String(rawItem.productId || ''));
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
    syncStoreIfExternallyModified();
    const orderNotifications = getNotificationsByCustomer(req.customerId!).map(
      sanitizeNotificationForClient
    );
    const announcements = getCatalogState().announcements.map((a) => ({
      id: `announcement-${a.id}`,
      type: 'boutique_announcement' as const,
      typeLabel: 'Boutique Announcement',
      title: a.title,
      message: a.message,
      timestamp: a.timestamp,
      read: false,
      actionRoute: 'explore' as const,
    }));
    const merged = [...orderNotifications, ...announcements].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    res.json({ notifications: merged });
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
  // Private Two-Device Owner Enrollment & Authentication (Zero Public Hints)
  // ---------------------------------------------------------------------------
  const enrollAttempts = new Map<string, { count: number; lockoutUntil: number; windowEnd: number }>();

  app.post('/api/owner/device/enroll', (req, res) => {
    syncStoreIfExternallyModified();

    const rateKey = req.ip || 'unknown';
    const ipHash = hashIp(req);
    const now = Date.now();
    const attemptState = enrollAttempts.get(rateKey);

    if (attemptState && attemptState.lockoutUntil > now) {
      recordOwnerSecurityAudit('ENROLLMENT_LOCKOUT', 'Rejected access attempt during active lockout.', {
        ipHash,
      });
      res.status(429).json({ authorized: false });
      return;
    }

    const body = req.body as {
      code?: unknown;
      deviceId?: unknown;
      deviceLabel?: unknown;
      platform?: unknown;
      publicKeyJwk?: unknown;
    };

    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const deviceId = cleanRequiredText(body?.deviceId, 80);
    const deviceLabel = cleanOptionalText(body?.deviceLabel, 80) || 'Authorized Device';
    const platform = body?.platform === 'android-capacitor' ? 'android-capacitor' : 'web';
    const publicKeyJwk = isValidPublicKeyJwk(body?.publicKeyJwk) ? body.publicKeyJwk : null;

    if (!code || !deviceId) {
      res.status(401).json({ authorized: false });
      return;
    }

    const result = enrollOwnerDeviceAtomic({
      submittedCode: code,
      deviceId,
      deviceLabel,
      platform,
      publicKeyJwk,
      uaHash: hashUa(req),
      ipHash,
    });

    if (!result.ok) {
      // Do not lock out normal short boutique multi-word searches; enforce strict lockout for access-code candidates
      const looksLikeAccessAttempt = code.length >= 10 && !/\s/.test(code);
      if (looksLikeAccessAttempt) {
        const withinWindow = attemptState && attemptState.windowEnd > now;
        const nextCount = withinWindow ? attemptState.count + 1 : 1;
        const nextWindowEnd = withinWindow ? attemptState.windowEnd : now + 15 * 60 * 1000;
        const lockoutUntil = nextCount >= 5 ? now + 15 * 60 * 1000 : 0;
        enrollAttempts.set(rateKey, {
          count: nextCount,
          lockoutUntil,
          windowEnd: nextWindowEnd,
        });
        if (lockoutUntil > 0) {
          recordOwnerSecurityAudit(
            'ENROLLMENT_LOCKOUT',
            'Temporary 15-minute lockout triggered after repeated failed enrollment attempts.',
            { deviceId, ipHash }
          );
          res.status(429).json({ authorized: false });
          return;
        }
      }

      // Uniform non-revealing rejection (never logs submitted code)
      res.status(401).json({ authorized: false });
      return;
    }

    enrollAttempts.delete(rateKey);

    if (platform === 'web') {
      setOwnerSessionCookie(req, res, result.rawToken);
      res.status(200).json({
        authorized: true,
        currentSlot: result.device.slot,
        currentDevice: sanitizeDeviceForClient(result.device, result.device.slot),
      });
      return;
    }

    // Native Capacitor device stores the device-bound token in Android Keystore via native plugin
    res.status(200).json({
      authorized: true,
      currentSlot: result.device.slot,
      currentDevice: sanitizeDeviceForClient(result.device, result.device.slot),
      nativeDeviceToken: result.rawToken,
    });
  });

  app.get('/api/owner/session', (req: AuthenticatedRequest, res) => {
    const { device } = resolveOwnerAuth(req);
    if (!device) {
      res.status(401).json({ authorized: false });
      return;
    }
    res.json({
      authorized: true,
      currentSlot: device.slot,
      currentDevice: sanitizeDeviceForClient(device, device.slot),
    });
  });

  app.post('/api/owner/security/logout', requireOwnerAuth, (req: AuthenticatedRequest, res) => {
    if (req.ownerUsedCookie) {
      clearOwnerSessionCookie(req, res);
    }
    res.json({ ok: true });
  });

  app.post('/api/owner/security/rotate-token', requireOwnerAuth, (req: AuthenticatedRequest, res) => {
    const rotated = rotateOwnerDeviceToken(req.ownerDevice!.slot, hashIp(req));
    if (!rotated.ok) {
      res.status(401).json({ error: 'Unable to rotate device token.' });
      return;
    }

    if (req.ownerDevice!.platform === 'web') {
      setOwnerSessionCookie(req, res, rotated.rawToken);
      res.json({
        ok: true,
        currentDevice: sanitizeDeviceForClient(rotated.device, rotated.device.slot),
      });
      return;
    }

    res.json({
      ok: true,
      nativeDeviceToken: rotated.rawToken,
      currentDevice: sanitizeDeviceForClient(rotated.device, rotated.device.slot),
    });
  });

  app.get('/api/owner/security/devices', requireOwnerAuth, (req: AuthenticatedRequest, res) => {
    res.json({ security: getOwnerSecuritySummary(req.ownerDevice!.slot) });
  });

  app.post(
    '/api/owner/security/devices/:slot/revoke',
    requireOwnerAuth,
    (req: AuthenticatedRequest, res) => {
      const slotNum = Number(req.params.slot);
      if (slotNum !== 1 && slotNum !== 2) {
        res.status(400).json({ error: 'Invalid device slot.' });
        return;
      }

      const revoked = revokeOwnerDevice(slotNum, req.ownerDevice!.slot, hashIp(req));
      if (!revoked) {
        res.status(404).json({ error: 'No active device found in that slot.' });
        return;
      }

      disconnectRevokedOwnerSlot(slotNum);
      if (slotNum === req.ownerDevice!.slot && req.ownerUsedCookie) {
        clearOwnerSessionCookie(req, res);
      }

      res.json({
        ok: true,
        revokedSelf: slotNum === req.ownerDevice!.slot,
        security: getOwnerSecuritySummary(req.ownerDevice!.slot),
      });
    }
  );

  app.post('/api/owner/security/replacement-code', requireOwnerAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body as { targetSlot?: unknown } | undefined;
    const requestedSlot = Number(body?.targetSlot);
    if (requestedSlot !== 1 && requestedSlot !== 2) {
      res.status(400).json({ error: 'Select slot 1 or slot 2 for replacement enrollment.' });
      return;
    }

    const issued = issueOwnerReplacementCode(requestedSlot, req.ownerDevice!.slot, hashIp(req));
    if (!issued.ok) {
      res.status(400).json({ error: issued.error });
      return;
    }

    res.json({
      code: issued.code,
      expiresAt: issued.expiresAt,
      targetSlot: requestedSlot,
      security: getOwnerSecuritySummary(req.ownerDevice!.slot),
    });
  });

  // Backend-credential emergency recovery (not linked anywhere in public customer UI)
  const recoveryAttempts = new Map<string, { count: number; lockoutUntil: number }>();
  app.post('/api/owner/security/emergency-recover', (req, res) => {
    const rateKey = req.ip || 'unknown';
    const ipHash = hashIp(req);
    const now = Date.now();
    const rec = recoveryAttempts.get(rateKey);
    if (rec && rec.lockoutUntil > now) {
      res.status(429).json({ error: 'Locked.' });
      return;
    }

    const configuredSecret = process.env.OWNER_RECOVERY_SECRET?.trim() || '';
    const headerSecret =
      typeof req.headers['x-owner-recovery-secret'] === 'string'
        ? req.headers['x-owner-recovery-secret'].trim()
        : '';

    if (
      !configuredSecret ||
      !headerSecret ||
      !timingSafeHexEqual(sha256Hex(headerSecret), sha256Hex(configuredSecret))
    ) {
      const nextCount = (rec?.count ?? 0) + 1;
      recoveryAttempts.set(rateKey, {
        count: nextCount,
        lockoutUntil: nextCount >= 3 ? now + 30 * 60 * 1000 : 0,
      });
      recordOwnerSecurityAudit('AUTH_FAILURE', 'Rejected invalid backend recovery attempt.', {
        ipHash,
      });
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    recoveryAttempts.delete(rateKey);
    const slotArg = (req.body as { slot?: unknown } | undefined)?.slot;
    const targetSlot: 1 | 2 | 'all' = slotArg === 1 ? 1 : slotArg === 2 ? 2 : 'all';
    emergencyRecoverOwnerSlots(targetSlot);
    if (targetSlot === 'all' || targetSlot === 1) disconnectRevokedOwnerSlot(1);
    if (targetSlot === 'all' || targetSlot === 2) disconnectRevokedOwnerSlot(2);
    res.json({ ok: true, recoveredSlot: targetSlot });
  });

  // ---------------------------------------------------------------------------
  // Protected Owner Product, Inventory, Campaign, Announcement & Settings Routes
  // ---------------------------------------------------------------------------
  app.post('/api/owner/products', requireOwnerAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body as Partial<Product> | undefined;
    const name = cleanRequiredText(body?.name, 140);
    const subtitle = cleanRequiredText(body?.subtitle, 160);
    const description = cleanRequiredText(body?.description, 1500);
    const material = cleanRequiredText(body?.material, 200);
    const care = cleanRequiredText(body?.care, 300);
    const category = body?.category;
    const priceUsd = Number(body?.priceUsd);
    const stockCount = Number(body?.stockCount);

    if (!name || !subtitle || !description || !material || !care) {
      res.status(400).json({ error: 'All product text details are required.' });
      return;
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Invalid product category.' });
      return;
    }
    if (!Number.isFinite(priceUsd) || priceUsd <= 0 || priceUsd > 500000) {
      res.status(400).json({ error: 'Enter a valid positive price in USD.' });
      return;
    }
    if (!Number.isInteger(stockCount) || stockCount < 0 || stockCount > 100000) {
      res.status(400).json({ error: 'Enter a valid non-negative integer stock count.' });
      return;
    }

    const images = Array.isArray(body?.images)
      ? body.images.map((u) => String(u).trim()).filter(isSafeImageUrl)
      : [];
    if (images.length === 0) {
      res.status(400).json({ error: 'Provide at least one valid HTTPS or boutique image path.' });
      return;
    }

    const sizes = Array.isArray(body?.sizes)
      ? body.sizes.map((s) => String(s).trim()).filter(Boolean).slice(0, 12)
      : [];
    if (sizes.length === 0) {
      res.status(400).json({ error: 'Provide at least one garment/item size.' });
      return;
    }

    const colors = Array.isArray(body?.colors)
      ? body.colors
          .filter((c) => c && typeof c.name === 'string' && typeof c.hex === 'string')
          .map((c) => ({
            name: c.name.trim().slice(0, 40),
            hex: /^#[0-9a-fA-F]{6}$/.test(c.hex.trim()) ? c.hex.trim() : '#D8C3A5',
          }))
          .filter((c) => c.name.length > 0)
      : [];
    if (colors.length === 0) {
      res.status(400).json({ error: 'Provide at least one colour option.' });
      return;
    }

    const slugId = `vr-${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32)}-${crypto.randomBytes(2).toString('hex')}`;

    const newProduct: Product = {
      id: slugId,
      name,
      subtitle,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      collectionId: cleanOptionalText(body?.collectionId, 60) || 'lumiere-soir',
      priceUsd: Number(priceUsd.toFixed(2)),
      images,
      description,
      material,
      care,
      sizes,
      colors,
      stockStatus: computeStockStatus(stockCount),
      stockCount,
      isNewArrival: Boolean(body?.isNewArrival),
      isBestSeller: Boolean(body?.isBestSeller),
    };

    addProductRecord(newProduct);
    const catalog = getCatalogState();
    broadcastToAllCustomers({ type: 'catalog:updated', ...catalog });
    broadcastToOwners({ type: 'catalog:updated', ...catalog });
    res.status(201).json({ product: newProduct, ...catalog });
  });

  app.patch('/api/owner/products/:id', requireOwnerAuth, (req: AuthenticatedRequest, res) => {
    const existing = getProductById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const body = req.body as Partial<Product> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Invalid product payload.' });
      return;
    }

    const nextCategory =
      body.category && VALID_CATEGORIES.includes(body.category)
        ? body.category
        : existing.category;
    const nextPrice =
      body.priceUsd !== undefined && Number.isFinite(Number(body.priceUsd)) && Number(body.priceUsd) > 0
        ? Number(Number(body.priceUsd).toFixed(2))
        : existing.priceUsd;
    const nextStockCount =
      body.stockCount !== undefined &&
      Number.isInteger(Number(body.stockCount)) &&
      Number(body.stockCount) >= 0
        ? Number(body.stockCount)
        : existing.stockCount;

    const nextImages = Array.isArray(body.images)
      ? body.images.map((u) => String(u).trim()).filter(isSafeImageUrl)
      : existing.images;
    if (nextImages.length === 0) {
      res.status(400).json({ error: 'Product must retain at least one valid image.' });
      return;
    }

    const nextSizes = Array.isArray(body.sizes)
      ? body.sizes.map((s) => String(s).trim()).filter(Boolean).slice(0, 12)
      : existing.sizes;
    if (nextSizes.length === 0) {
      res.status(400).json({ error: 'Product must retain at least one size.' });
      return;
    }

    const nextColors = Array.isArray(body.colors)
      ? body.colors
          .filter((c) => c && typeof c.name === 'string' && typeof c.hex === 'string')
          .map((c) => ({
            name: c.name.trim().slice(0, 40),
            hex: /^#[0-9a-fA-F]{6}$/.test(c.hex.trim()) ? c.hex.trim() : '#D8C3A5',
          }))
          .filter((c) => c.name.length > 0)
      : existing.colors;
    if (nextColors.length === 0) {
      res.status(400).json({ error: 'Product must retain at least one colour.' });
      return;
    }

    const updated = updateProductRecord(existing.id, (curr) => ({
      ...curr,
      name: cleanOptionalText(body.name, 140) || curr.name,
      subtitle: cleanOptionalText(body.subtitle, 160) || curr.subtitle,
      category: nextCategory,
      categoryLabel: CATEGORY_LABELS[nextCategory],
      collectionId: cleanOptionalText(body.collectionId, 60) || curr.collectionId,
      priceUsd: nextPrice,
      images: nextImages,
      description: cleanOptionalText(body.description, 1500) || curr.description,
      material: cleanOptionalText(body.material, 200) || curr.material,
      care: cleanOptionalText(body.care, 300) || curr.care,
      sizes: nextSizes,
      colors: nextColors,
      stockCount: nextStockCount,
      stockStatus: computeStockStatus(nextStockCount),
      isNewArrival:
        typeof body.isNewArrival === 'boolean' ? body.isNewArrival : curr.isNewArrival,
      isBestSeller:
        typeof body.isBestSeller === 'boolean' ? body.isBestSeller : curr.isBestSeller,
    }));

    const catalog = getCatalogState();
    broadcastToAllCustomers({ type: 'catalog:updated', ...catalog });
    broadcastToOwners({ type: 'catalog:updated', ...catalog });
    res.json({ product: updated, ...catalog });
  });

  app.delete('/api/owner/products/:id', requireOwnerAuth, (req: AuthenticatedRequest, res) => {
    const deleted = deleteProductRecord(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const catalog = getCatalogState();
    broadcastToAllCustomers({ type: 'catalog:updated', ...catalog });
    broadcastToOwners({ type: 'catalog:updated', ...catalog });
    res.json({ ok: true, ...catalog });
  });

  app.patch(
    '/api/owner/products/:id/inventory',
    requireOwnerAuth,
    (req: AuthenticatedRequest, res) => {
      const stockCount = Number((req.body as { stockCount?: unknown })?.stockCount);
      if (!Number.isInteger(stockCount) || stockCount < 0 || stockCount > 100000) {
        res.status(400).json({ error: 'Invalid stock count.' });
        return;
      }
      const updated = updateProductRecord(req.params.id, (curr) => ({
        ...curr,
        stockCount,
        stockStatus: computeStockStatus(stockCount),
      }));
      if (!updated) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      const catalog = getCatalogState();
      broadcastToAllCustomers({ type: 'catalog:updated', ...catalog });
      broadcastToOwners({ type: 'catalog:updated', ...catalog });
      res.json({ product: updated, ...catalog });
    }
  );

  app.patch('/api/owner/campaigns/:id', requireOwnerAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body as {
      kicker?: unknown;
      title?: unknown;
      description?: unknown;
      ctaLabel?: unknown;
      image?: unknown;
      targetCategory?: unknown;
    };

    const updated = updateCampaignRecord(req.params.id, (curr) => ({
      ...curr,
      kicker: cleanOptionalText(body?.kicker, 80) || curr.kicker,
      title: cleanOptionalText(body?.title, 160) || curr.title,
      description: cleanOptionalText(body?.description, 400) || curr.description,
      ctaLabel: cleanOptionalText(body?.ctaLabel, 60) || curr.ctaLabel,
      image:
        typeof body?.image === 'string' && isSafeImageUrl(body.image)
          ? body.image.trim()
          : curr.image,
      targetCategory:
        typeof body?.targetCategory === 'string' &&
        (body.targetCategory === 'all' ||
          VALID_CATEGORIES.includes(body.targetCategory as Exclude<CategorySlug, 'all'>))
          ? (body.targetCategory as CategorySlug)
          : curr.targetCategory,
    }));

    if (!updated) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }
    const catalog = getCatalogState();
    broadcastToAllCustomers({ type: 'catalog:updated', ...catalog });
    broadcastToOwners({ type: 'catalog:updated', ...catalog });
    res.json({ campaign: updated, ...catalog });
  });

  app.patch('/api/owner/collections/:id', requireOwnerAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body as {
      title?: unknown;
      season?: unknown;
      summary?: unknown;
      image?: unknown;
      filterCategory?: unknown;
    };

    const updated = updateCollectionRecord(req.params.id, (curr) => ({
      ...curr,
      title: cleanOptionalText(body?.title, 100) || curr.title,
      season: cleanOptionalText(body?.season, 80) || curr.season,
      summary: cleanOptionalText(body?.summary, 300) || curr.summary,
      image:
        typeof body?.image === 'string' && isSafeImageUrl(body.image)
          ? body.image.trim()
          : curr.image,
      filterCategory:
        typeof body?.filterCategory === 'string' &&
        (body.filterCategory === 'all' ||
          VALID_CATEGORIES.includes(body.filterCategory as Exclude<CategorySlug, 'all'>))
          ? (body.filterCategory as CategorySlug)
          : curr.filterCategory,
    }));

    if (!updated) {
      res.status(404).json({ error: 'Collection not found.' });
      return;
    }
    const catalog = getCatalogState();
    broadcastToAllCustomers({ type: 'catalog:updated', ...catalog });
    broadcastToOwners({ type: 'catalog:updated', ...catalog });
    res.json({ collection: updated, ...catalog });
  });

  app.post('/api/owner/announcements', requireOwnerAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body as { title?: unknown; message?: unknown } | undefined;
    const title = cleanRequiredText(body?.title, 120);
    const message = cleanRequiredText(body?.message, 600);
    if (!title || !message) {
      res.status(400).json({ error: 'Provide both an announcement title and message.' });
      return;
    }

    const announcement = addBoutiqueAnnouncement(title, message);
    const customerNotification = {
      id: `announcement-${announcement.id}`,
      type: 'boutique_announcement' as const,
      typeLabel: 'Boutique Announcement',
      title: announcement.title,
      message: announcement.message,
      timestamp: announcement.timestamp,
      read: false,
      actionRoute: 'explore' as const,
    };

    broadcastToAllCustomers({
      type: 'boutique:announcement',
      notification: customerNotification,
      announcement,
    });
    const catalog = getCatalogState();
    broadcastToOwners({ type: 'catalog:updated', ...catalog });
    res.status(201).json({ announcement, ...catalog });
  });

  app.put('/api/owner/settings', requireOwnerAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body as {
      boutiqueName?: unknown;
      defaultCurrency?: unknown;
      giftPresentationAvailable?: unknown;
      giftPresentationLabel?: unknown;
      pickupLocationNote?: unknown;
    };

    const boutiqueName = cleanOptionalText(body?.boutiqueName, 80);
    const defaultCurrency =
      typeof body?.defaultCurrency === 'string' &&
      SUPPORTED_CURRENCIES.includes(body.defaultCurrency as CurrencyCode)
        ? (body.defaultCurrency as CurrencyCode)
        : undefined;
    const giftPresentationLabel = cleanOptionalText(body?.giftPresentationLabel, 180);
    const pickupLocationNote = cleanOptionalText(body?.pickupLocationNote, 300);

    const updatedSettings = updateStoreSettingsRecord({
      ...(boutiqueName ? { boutiqueName } : {}),
      ...(defaultCurrency ? { defaultCurrency } : {}),
      ...(typeof body?.giftPresentationAvailable === 'boolean'
        ? { giftPresentationAvailable: body.giftPresentationAvailable }
        : {}),
      ...(giftPresentationLabel ? { giftPresentationLabel } : {}),
      ...(pickupLocationNote ? { pickupLocationNote } : {}),
    });

    const catalog = getCatalogState();
    broadcastToAllCustomers({ type: 'catalog:updated', ...catalog });
    broadcastToOwners({ type: 'catalog:updated', ...catalog });
    res.json(catalog);
  });

  // ---------------------------------------------------------------------------
  // Owner Order Management (Strictly Protected by Device-Bound Owner Auth)
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

    sendToOrderSubscribers(updated, {
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

    sendToOrderSubscribers(updated, {
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
    sendToOrderSubscribers(updated, {
      type: 'order:updated',
      order: publicOrder,
    });
    broadcastToOwners({ type: 'owner:order_updated', order: publicOrder });

    res.json({ order: publicOrder });
  });

  // ---------------------------------------------------------------------------
  // Frontend Serving (Vite Dev Middleware, Built Static Dist, or API-Only Mode)
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
    const distIndexPath = path.resolve(distDir, 'index.html');
    if (fs.existsSync(distIndexPath)) {
      app.use(express.static(distDir));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path === '/health' || req.path === '/ws') {
          next();
          return;
        }
        res.sendFile(distIndexPath);
      });
    } else {
      app.get('/', (_req, res) => {
        res.status(200).json({
          service: 'vey-rasha-api',
          status: 'ok',
          health: '/health',
        });
      });
      app.use((req, res) => {
        res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
      });
    }
  }

  // Non-leaking production error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON request body.' });
      return;
    }
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`VEY RASHA server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VEY RASHA server:', err);
  process.exit(1);
});
