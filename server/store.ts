import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  EDITORIAL_CAMPAIGNS,
  FEATURED_COLLECTIONS,
  PRODUCTS,
} from '../src/data/catalog.ts';
import { DEFAULT_STORE_SETTINGS } from '../src/data/storeConfig.ts';
import type {
  Collection,
  EditorialCampaign,
  NotificationItem,
  OrderRecord,
  Product,
  StoreSettings,
} from '../src/types/boutique.ts';
import type {
  OwnerAuditEventType,
  OwnerDeviceSlot,
  OwnerDeviceSummary,
  OwnerSecurityAuditEntry,
  OwnerSecuritySummary,
} from './types.ts';

export interface StoredOrderRecord extends OrderRecord {
  customerSessionId: string;
  authorizedCustomerSessionIds?: string[];
}

export interface StoredNotificationRecord extends NotificationItem {
  customerSessionId: string;
}

export interface StoredOwnerDevice {
  slot: OwnerDeviceSlot;
  deviceId: string;
  deviceLabel: string;
  platform: 'web' | 'android-capacitor';
  tokenHash: string;
  publicKeyJwk: JsonWebKey | null;
  uaHash: string;
  enrolledAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
}

export interface StoredReplacementCode {
  codeHash: string;
  targetSlot: OwnerDeviceSlot;
  createdAt: string;
  expiresAt: string;
  issuedBySlot: OwnerDeviceSlot;
}

export interface StoredOwnerSecurity {
  devices: StoredOwnerDevice[];
  consumedCodeHashes: string[];
  replacementCode: StoredReplacementCode | null;
  auditLogs: OwnerSecurityAuditEntry[];
}

export interface StoredBoutiqueAnnouncement {
  id: string;
  title: string;
  message: string;
  timestamp: string;
}

interface BoutiqueStoreData {
  ownerSecurity: StoredOwnerSecurity;
  products: Product[];
  collections: Collection[];
  campaigns: EditorialCampaign[];
  storeSettings: StoreSettings;
  announcements: StoredBoutiqueAnnouncement[];
  orders: StoredOrderRecord[];
  notifications: StoredNotificationRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.resolve(DATA_DIR, 'boutique-store.json');

if (!STORE_FILE.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid store file path');
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function timingSafeHexEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const bufB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

function createEmptySecurity(): StoredOwnerSecurity {
  return {
    devices: [],
    consumedCodeHashes: [],
    replacementCode: null,
    auditLogs: [],
  };
}

function createEmptyStore(): BoutiqueStoreData {
  return {
    ownerSecurity: createEmptySecurity(),
    products: PRODUCTS.map((p) => ({
      ...p,
      images: [...p.images],
      sizes: [...p.sizes],
      colors: p.colors.map((c) => ({ ...c })),
    })),
    collections: FEATURED_COLLECTIONS.map((c) => ({ ...c })),
    campaigns: EDITORIAL_CAMPAIGNS.map((c) => ({ ...c })),
    storeSettings: { ...DEFAULT_STORE_SETTINGS },
    announcements: [],
    orders: [],
    notifications: [],
  };
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function assertTwoDeviceInvariant(security: StoredOwnerSecurity): void {
  const activeDevices = security.devices.filter((d) => d.revokedAt === null);
  if (activeDevices.length > 2) {
    throw new Error('Security invariant violation: maximum of 2 active owner devices exceeded.');
  }
  const activeSlots = new Set<OwnerDeviceSlot>();
  for (const device of activeDevices) {
    if (device.slot !== 1 && device.slot !== 2) {
      throw new Error('Security invariant violation: invalid device slot.');
    }
    if (activeSlots.has(device.slot)) {
      throw new Error(`Security invariant violation: duplicate active device in slot ${device.slot}.`);
    }
    activeSlots.add(device.slot);
  }
}

function loadStore(): BoutiqueStoreData {
  ensureDataDir();
  const fallback = createEmptyStore();
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<BoutiqueStoreData>;
    const security: StoredOwnerSecurity = {
      devices: Array.isArray(parsed.ownerSecurity?.devices) ? parsed.ownerSecurity.devices : [],
      consumedCodeHashes: Array.isArray(parsed.ownerSecurity?.consumedCodeHashes)
        ? parsed.ownerSecurity.consumedCodeHashes
        : [],
      replacementCode: parsed.ownerSecurity?.replacementCode ?? null,
      auditLogs: Array.isArray(parsed.ownerSecurity?.auditLogs)
        ? parsed.ownerSecurity.auditLogs
        : [],
    };
    assertTwoDeviceInvariant(security);

    return {
      ownerSecurity: security,
      products:
        Array.isArray(parsed.products) && parsed.products.length > 0
          ? parsed.products
          : fallback.products,
      collections:
        Array.isArray(parsed.collections) && parsed.collections.length > 0
          ? parsed.collections
          : fallback.collections,
      campaigns:
        Array.isArray(parsed.campaigns) && parsed.campaigns.length > 0
          ? parsed.campaigns
          : fallback.campaigns,
      storeSettings: parsed.storeSettings
        ? { ...fallback.storeSettings, ...parsed.storeSettings }
        : fallback.storeSettings,
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    };
  } catch {
    return fallback;
  }
}

let lastKnownMtimeMs = 0;
let state: BoutiqueStoreData = loadStore();
try {
  lastKnownMtimeMs = fs.statSync(STORE_FILE).mtimeMs;
} catch {
  lastKnownMtimeMs = 0;
}

function persistStore(): void {
  assertTwoDeviceInvariant(state.ownerSecurity);
  ensureDataDir();
  const tmpFile = path.resolve(DATA_DIR, `boutique-store.${process.pid}.tmp`);
  if (!tmpFile.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temp store path');
  }
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, STORE_FILE);
  try {
    lastKnownMtimeMs = fs.statSync(STORE_FILE).mtimeMs;
  } catch {
    // Ignore stat error
  }
}

export function syncStoreIfExternallyModified(): void {
  try {
    const mtime = fs.statSync(STORE_FILE).mtimeMs;
    if (mtime > lastKnownMtimeMs) {
      state = loadStore();
      lastKnownMtimeMs = mtime;
    }
  } catch {
    // Ignore stat error
  }
}

function appendAuditLog(entry: Omit<OwnerSecurityAuditEntry, 'id' | 'timestamp'>): void {
  const full: OwnerSecurityAuditEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  state.ownerSecurity.auditLogs.unshift(full);
  if (state.ownerSecurity.auditLogs.length > 100) {
    state.ownerSecurity.auditLogs = state.ownerSecurity.auditLogs.slice(0, 100);
  }
}

export function recordOwnerSecurityAudit(
  eventType: OwnerAuditEventType,
  detail: string,
  meta?: {
    slot?: OwnerDeviceSlot;
    deviceId?: string;
    deviceLabel?: string;
    ipHash?: string;
  }
): void {
  appendAuditLog({
    eventType,
    detail,
    slot: meta?.slot,
    deviceId: meta?.deviceId,
    deviceLabel: meta?.deviceLabel,
    ipHash: meta?.ipHash,
  });
  persistStore();
}

export function sanitizeDeviceForClient(
  device: StoredOwnerDevice,
  currentSlot?: OwnerDeviceSlot
): OwnerDeviceSummary {
  return {
    slot: device.slot,
    deviceId: device.deviceId,
    deviceLabel: device.deviceLabel,
    platform: device.platform,
    keyBound: Boolean(device.publicKeyJwk),
    enrolledAt: device.enrolledAt,
    lastSeenAt: device.lastSeenAt,
    revokedAt: device.revokedAt,
    isCurrentDevice: currentSlot !== undefined ? device.slot === currentSlot && device.revokedAt === null : undefined,
  };
}

export function getActiveOwnerDevices(): StoredOwnerDevice[] {
  return state.ownerSecurity.devices.filter((d) => d.revokedAt === null);
}

export function getOwnerSecuritySummary(currentSlot: OwnerDeviceSlot): OwnerSecuritySummary {
  const code1 = process.env.OWNER_ENROLLMENT_CODE_1?.trim() || '';
  const code2 = process.env.OWNER_ENROLLMENT_CODE_2?.trim() || '';
  const code1Hash = code1 ? sha256Hex(code1) : '';
  const code2Hash = code2 ? sha256Hex(code2) : '';

  const activeDevices = getActiveOwnerDevices();
  const replacement = state.ownerSecurity.replacementCode;
  const validReplacement =
    replacement && new Date(replacement.expiresAt).getTime() > Date.now()
      ? { targetSlot: replacement.targetSlot, expiresAt: replacement.expiresAt }
      : null;

  const slot1Open = Boolean(code1Hash && !state.ownerSecurity.consumedCodeHashes.includes(code1Hash));
  const slot2Open = Boolean(code2Hash && !state.ownerSecurity.consumedCodeHashes.includes(code2Hash));

  return {
    maxDevices: 2,
    activeDeviceCount: activeDevices.length,
    enrollmentOpen: activeDevices.length < 2 && (slot1Open || slot2Open || Boolean(validReplacement)),
    slot1EnvConfigured: Boolean(code1),
    slot2EnvConfigured: Boolean(code2),
    slot1Consumed: Boolean(code1Hash && state.ownerSecurity.consumedCodeHashes.includes(code1Hash)),
    slot2Consumed: Boolean(code2Hash && state.ownerSecurity.consumedCodeHashes.includes(code2Hash)),
    activeReplacementCode: validReplacement,
    devices: state.ownerSecurity.devices
      .slice()
      .sort((a, b) => {
        if (a.revokedAt === null && b.revokedAt !== null) return -1;
        if (a.revokedAt !== null && b.revokedAt === null) return 1;
        return b.enrolledAt.localeCompare(a.enrolledAt);
      })
      .map((d) => sanitizeDeviceForClient(d, currentSlot)),
    auditLogs: state.ownerSecurity.auditLogs.slice(0, 50),
  };
}

export interface EnrollDeviceParams {
  submittedCode: string;
  deviceId: string;
  deviceLabel: string;
  platform: 'web' | 'android-capacitor';
  publicKeyJwk: JsonWebKey | null;
  uaHash: string;
  ipHash: string;
}

export type EnrollDeviceResult =
  | { ok: true; rawToken: string; device: StoredOwnerDevice }
  | { ok: false; reason: string };

/**
 * Atomically verifies single-use enrollment codes (or active replacement code),
 * consumes the code permanently, enforces the strict max-2-device limit,
 * and binds a cryptographically random opaque token to the registered device.
 */
export function enrollOwnerDeviceAtomic(params: EnrollDeviceParams): EnrollDeviceResult {
  const { submittedCode, deviceId, deviceLabel, platform, publicKeyJwk, uaHash, ipHash } = params;
  const trimmedCode = submittedCode.trim();
  if (!trimmedCode || trimmedCode.length < 8) {
    return { ok: false, reason: 'Invalid format' };
  }

  const activeDevices = getActiveOwnerDevices();
  if (activeDevices.length >= 2) {
    appendAuditLog({
      eventType: 'ENROLLMENT_DENIED',
      deviceId,
      deviceLabel,
      ipHash,
      detail: 'Enrollment rejected because maximum limit of 2 authorized devices is already active.',
    });
    persistStore();
    return { ok: false, reason: 'Device limit reached' };
  }

  const submittedHash = sha256Hex(trimmedCode);

  if (state.ownerSecurity.consumedCodeHashes.includes(submittedHash)) {
    appendAuditLog({
      eventType: 'ENROLLMENT_DENIED',
      deviceId,
      deviceLabel,
      ipHash,
      detail: 'Rejected attempt to reuse an already-consumed single-use enrollment code.',
    });
    persistStore();
    return { ok: false, reason: 'Already consumed' };
  }

  const envCode1 = process.env.OWNER_ENROLLMENT_CODE_1?.trim() || '';
  const envCode2 = process.env.OWNER_ENROLLMENT_CODE_2?.trim() || '';
  const envCode1Hash = envCode1 ? sha256Hex(envCode1) : '';
  const envCode2Hash = envCode2 ? sha256Hex(envCode2) : '';

  let targetSlot: OwnerDeviceSlot | null = null;
  let usedReplacement = false;

  if (envCode1Hash && timingSafeHexEqual(submittedHash, envCode1Hash)) {
    targetSlot = 1;
  } else if (envCode2Hash && timingSafeHexEqual(submittedHash, envCode2Hash)) {
    targetSlot = 2;
  } else if (state.ownerSecurity.replacementCode) {
    const rep = state.ownerSecurity.replacementCode;
    const notExpired = new Date(rep.expiresAt).getTime() > Date.now();
    if (notExpired && timingSafeHexEqual(submittedHash, rep.codeHash)) {
      targetSlot = rep.targetSlot;
      usedReplacement = true;
    }
  }

  if (targetSlot === null) {
    appendAuditLog({
      eventType: 'ENROLLMENT_DENIED',
      deviceId,
      deviceLabel,
      ipHash,
      detail: 'Unrecognized or expired enrollment credential submitted.',
    });
    persistStore();
    return { ok: false, reason: 'Invalid credential' };
  }

  // Ensure slot does not already have an active device
  const slotOccupied = activeDevices.some((d) => d.slot === targetSlot);
  if (slotOccupied) {
    appendAuditLog({
      eventType: 'ENROLLMENT_DENIED',
      slot: targetSlot,
      deviceId,
      deviceLabel,
      ipHash,
      detail: `Rejected enrollment into slot ${targetSlot} because an active device is already bound to it.`,
    });
    persistStore();
    return { ok: false, reason: 'Slot occupied' };
  }

  // Ensure the same physical deviceId isn't holding the other active slot cleanly
  if (activeDevices.some((d) => d.deviceId === deviceId)) {
    appendAuditLog({
      eventType: 'ENROLLMENT_DENIED',
      slot: targetSlot,
      deviceId,
      deviceLabel,
      ipHash,
      detail: 'Rejected duplicate enrollment from a device already bound to an active slot.',
    });
    persistStore();
    return { ok: false, reason: 'Device already enrolled' };
  }

  // Consume code permanently and register device atomically
  state.ownerSecurity.consumedCodeHashes.push(submittedHash);
  if (usedReplacement) {
    state.ownerSecurity.replacementCode = null;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const nowIso = new Date().toISOString();

  const newDevice: StoredOwnerDevice = {
    slot: targetSlot,
    deviceId,
    deviceLabel,
    platform,
    tokenHash: sha256Hex(rawToken),
    publicKeyJwk,
    uaHash,
    enrolledAt: nowIso,
    lastSeenAt: nowIso,
    revokedAt: null,
  };

  state.ownerSecurity.devices.push(newDevice);
  appendAuditLog({
    eventType: 'ENROLLMENT_SUCCESS',
    slot: targetSlot,
    deviceId,
    deviceLabel,
    ipHash,
    detail: usedReplacement
      ? `Authorized replacement device enrolled in slot ${targetSlot} via single-use replacement code.`
      : `Authorized owner device enrolled in slot ${targetSlot}.`,
  });

  persistStore();
  return { ok: true, rawToken, device: newDevice };
}

export function findActiveDeviceByToken(
  rawToken: string,
  deviceId?: string | null
): StoredOwnerDevice | null {
  if (!rawToken) return null;
  const candidateHash = sha256Hex(rawToken);

  for (const device of state.ownerSecurity.devices) {
    if (device.revokedAt !== null || !device.tokenHash) continue;
    if (timingSafeHexEqual(candidateHash, device.tokenHash)) {
      if (deviceId && device.deviceId !== deviceId) {
        return null;
      }
      const now = Date.now();
      if (now - new Date(device.lastSeenAt).getTime() > 60_000) {
        device.lastSeenAt = new Date(now).toISOString();
        persistStore();
      }
      return device;
    }
  }
  return null;
}

export function rotateOwnerDeviceToken(
  slot: OwnerDeviceSlot,
  ipHash: string
): { ok: true; rawToken: string; device: StoredOwnerDevice } | { ok: false } {
  const device = state.ownerSecurity.devices.find((d) => d.slot === slot && d.revokedAt === null);
  if (!device) return { ok: false };

  const rawToken = crypto.randomBytes(32).toString('hex');
  device.tokenHash = sha256Hex(rawToken);
  device.lastSeenAt = new Date().toISOString();
  appendAuditLog({
    eventType: 'TOKEN_ROTATED',
    slot: device.slot,
    deviceId: device.deviceId,
    deviceLabel: device.deviceLabel,
    ipHash,
    detail: `Device token rotated for slot ${device.slot}.`,
  });
  persistStore();
  return { ok: true, rawToken, device };
}

export function revokeOwnerDevice(
  targetSlot: OwnerDeviceSlot,
  actedBySlot: OwnerDeviceSlot,
  ipHash: string
): StoredOwnerDevice | null {
  const device = state.ownerSecurity.devices.find(
    (d) => d.slot === targetSlot && d.revokedAt === null
  );
  if (!device) return null;

  device.revokedAt = new Date().toISOString();
  device.tokenHash = '';

  if (state.ownerSecurity.replacementCode?.targetSlot === targetSlot) {
    state.ownerSecurity.replacementCode = null;
  }

  appendAuditLog({
    eventType: 'DEVICE_REVOKED',
    slot: targetSlot,
    deviceId: device.deviceId,
    deviceLabel: device.deviceLabel,
    ipHash,
    detail:
      targetSlot === actedBySlot
        ? `Slot ${targetSlot} revoked its own access.`
        : `Slot ${targetSlot} access was revoked by authorized device in slot ${actedBySlot}.`,
  });
  persistStore();
  return device;
}

export function issueOwnerReplacementCode(
  targetSlot: OwnerDeviceSlot,
  issuedBySlot: OwnerDeviceSlot,
  ipHash: string
): { ok: true; code: string; expiresAt: string } | { ok: false; error: string } {
  const activeDevices = getActiveOwnerDevices();
  if (activeDevices.length >= 2) {
    return { ok: false, error: 'Revoke a lost device before issuing a replacement code.' };
  }
  if (activeDevices.some((d) => d.slot === targetSlot)) {
    return { ok: false, error: `Slot ${targetSlot} already has an active authorized device.` };
  }

  const rawCode = `VR-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
  const now = Date.now();
  const expiresAt = new Date(now + 15 * 60 * 1000).toISOString();

  state.ownerSecurity.replacementCode = {
    codeHash: sha256Hex(rawCode),
    targetSlot,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    issuedBySlot,
  };

  appendAuditLog({
    eventType: 'REPLACEMENT_CODE_CREATED',
    slot: targetSlot,
    ipHash,
    detail: `Single-use replacement code issued for vacant slot ${targetSlot} by slot ${issuedBySlot} (expires in 15 minutes).`,
  });
  persistStore();
  return { ok: true, code: rawCode, expiresAt };
}

/**
 * Backend-controlled emergency recovery when both authorized phones are lost.
 * Invoked exclusively from server-side CLI (`npm run owner:recover`) with OWNER_RECOVERY_SECRET.
 */
export function emergencyRecoverOwnerSlots(resetSlot: 1 | 2 | 'all'): void {
  const nowIso = new Date().toISOString();
  let revokedCount = 0;
  for (const device of state.ownerSecurity.devices) {
    if (device.revokedAt === null && (resetSlot === 'all' || device.slot === resetSlot)) {
      device.revokedAt = nowIso;
      device.tokenHash = '';
      revokedCount += 1;
    }
  }
  state.ownerSecurity.replacementCode = null;
  appendAuditLog({
    eventType: 'EMERGENCY_RECOVERY',
    detail: `Backend emergency recovery executed for slot=${String(resetSlot)} (${revokedCount} active device(s) revoked). Configure fresh OWNER_ENROLLMENT_CODE values before re-enrolling.`,
  });
  persistStore();
}

// -----------------------------------------------------------------------------
// Catalog, Campaigns, Announcements & Store Settings
// -----------------------------------------------------------------------------
export function getCatalogState(): {
  products: Product[];
  collections: Collection[];
  campaigns: EditorialCampaign[];
  storeSettings: StoreSettings;
  announcements: StoredBoutiqueAnnouncement[];
} {
  return {
    products: state.products,
    collections: state.collections,
    campaigns: state.campaigns,
    storeSettings: state.storeSettings,
    announcements: state.announcements,
  };
}

export function getProductById(productId: string): Product | undefined {
  return state.products.find((p) => p.id === productId);
}

export function addProductRecord(product: Product): Product {
  state.products.unshift(product);
  persistStore();
  return product;
}

export function updateProductRecord(
  productId: string,
  updater: (current: Product) => Product
): Product | null {
  const idx = state.products.findIndex((p) => p.id === productId);
  if (idx === -1) return null;
  const updated = updater(state.products[idx]);
  state.products[idx] = updated;
  persistStore();
  return updated;
}

export function deleteProductRecord(productId: string): boolean {
  const before = state.products.length;
  state.products = state.products.filter((p) => p.id !== productId);
  if (state.products.length === before) return false;
  persistStore();
  return true;
}

export function getCampaignById(campaignId: string): EditorialCampaign | undefined {
  return state.campaigns.find((c) => c.id === campaignId);
}

export function addCampaignRecord(campaign: EditorialCampaign): EditorialCampaign {
  state.campaigns.unshift(campaign);
  persistStore();
  return campaign;
}

export function updateCampaignRecord(
  campaignId: string,
  updater: (current: EditorialCampaign) => EditorialCampaign
): EditorialCampaign | null {
  const idx = state.campaigns.findIndex((c) => c.id === campaignId);
  if (idx === -1) return null;
  const updated = updater(state.campaigns[idx]);
  state.campaigns[idx] = updated;
  persistStore();
  return updated;
}

export function deleteCampaignRecord(campaignId: string): boolean {
  const before = state.campaigns.length;
  state.campaigns = state.campaigns.filter((c) => c.id !== campaignId);
  if (state.campaigns.length === before) return false;
  persistStore();
  return true;
}

export function getCollectionById(collectionId: string): Collection | undefined {
  return state.collections.find((c) => c.id === collectionId || c.slug === collectionId);
}

export function addCollectionRecord(collection: Collection): Collection {
  state.collections.unshift(collection);
  persistStore();
  return collection;
}

export function updateCollectionRecord(
  collectionId: string,
  updater: (current: Collection) => Collection
): Collection | null {
  const idx = state.collections.findIndex((c) => c.id === collectionId || c.slug === collectionId);
  if (idx === -1) return null;
  const updated = updater(state.collections[idx]);
  state.collections[idx] = updated;
  persistStore();
  return updated;
}

export function deleteCollectionRecord(collectionId: string): boolean {
  const before = state.collections.length;
  state.collections = state.collections.filter(
    (c) => c.id !== collectionId && c.slug !== collectionId
  );
  if (state.collections.length === before) return false;
  persistStore();
  return true;
}

export function updateStoreSettingsRecord(patch: Partial<StoreSettings>): StoreSettings {
  state.storeSettings = {
    ...state.storeSettings,
    ...patch,
  };
  persistStore();
  return state.storeSettings;
}

export function addBoutiqueAnnouncement(title: string, message: string): StoredBoutiqueAnnouncement {
  const entry: StoredBoutiqueAnnouncement = {
    id: crypto.randomUUID(),
    title,
    message,
    timestamp: new Date().toISOString(),
  };
  state.announcements.unshift(entry);
  if (state.announcements.length > 30) {
    state.announcements = state.announcements.slice(0, 30);
  }
  persistStore();
  return entry;
}

// -----------------------------------------------------------------------------
// Orders & Notifications
// -----------------------------------------------------------------------------
export function sanitizeOrderForClient(stored: StoredOrderRecord): OrderRecord {
  const {
    customerSessionId: _omitSession,
    authorizedCustomerSessionIds: _omitAuth,
    ...publicOrder
  } = stored;
  return publicOrder;
}

export function sanitizeNotificationForClient(stored: StoredNotificationRecord): NotificationItem {
  const { customerSessionId: _omit, ...publicNotification } = stored;
  return publicNotification;
}

export function hasOrderReference(orderReference: string): boolean {
  return state.orders.some((o) => o.orderReference === orderReference);
}

export function insertOrder(order: StoredOrderRecord): void {
  state.orders.unshift(order);
  persistStore();
}

export function isCustomerAuthorizedForOrder(
  order: StoredOrderRecord,
  customerSessionId: string
): boolean {
  if (order.customerSessionId === customerSessionId) return true;
  return Boolean(order.authorizedCustomerSessionIds?.includes(customerSessionId));
}

export function getOrdersByCustomer(customerSessionId: string): StoredOrderRecord[] {
  return state.orders
    .filter((o) => isCustomerAuthorizedForOrder(o, customerSessionId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getAllOrders(): StoredOrderRecord[] {
  return [...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getOrderById(orderId: string): StoredOrderRecord | undefined {
  return state.orders.find((o) => o.id === orderId);
}

export function getOrderByReference(orderReference: string): StoredOrderRecord | undefined {
  const normalized = orderReference.trim().toUpperCase();
  return state.orders.find((o) => o.orderReference.toUpperCase() === normalized);
}

export function authorizeCustomerForOrder(
  orderId: string,
  customerSessionId: string
): StoredOrderRecord | null {
  const target = state.orders.find((o) => o.id === orderId);
  if (!target) return null;
  if (!isCustomerAuthorizedForOrder(target, customerSessionId)) {
    const currentList = target.authorizedCustomerSessionIds ?? [];
    target.authorizedCustomerSessionIds = [...currentList, customerSessionId];
    persistStore();
  }
  return target;
}

export function updateOrderRecord(
  orderId: string,
  updater: (current: StoredOrderRecord) => StoredOrderRecord
): StoredOrderRecord | null {
  const idx = state.orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return null;
  const updated = updater(state.orders[idx]);
  state.orders[idx] = updated;
  persistStore();
  return updated;
}

export function insertNotification(notification: StoredNotificationRecord): void {
  state.notifications.unshift(notification);
  persistStore();
}

function isCustomerAuthorizedForNotification(
  notification: StoredNotificationRecord,
  customerSessionId: string
): boolean {
  if (notification.customerSessionId === customerSessionId) return true;
  if (!notification.orderId) return false;
  const linkedOrder = getOrderById(notification.orderId);
  return linkedOrder ? isCustomerAuthorizedForOrder(linkedOrder, customerSessionId) : false;
}

export function getNotificationsByCustomer(customerSessionId: string): StoredNotificationRecord[] {
  return state.notifications
    .filter((n) => isCustomerAuthorizedForNotification(n, customerSessionId))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function markCustomerNotificationRead(
  customerSessionId: string,
  notificationId: string
): boolean {
  const target = state.notifications.find(
    (n) => n.id === notificationId && isCustomerAuthorizedForNotification(n, customerSessionId)
  );
  if (!target) return false;
  target.read = true;
  persistStore();
  return true;
}

export function markAllCustomerNotificationsRead(customerSessionId: string): void {
  let changed = false;
  for (const item of state.notifications) {
    if (isCustomerAuthorizedForNotification(item, customerSessionId) && !item.read) {
      item.read = true;
      changed = true;
    }
  }
  if (changed) {
    persistStore();
  }
}
