import fs from 'fs';
import path from 'path';
import type {
  NotificationItem,
  OrderRecord,
} from '../src/types/boutique.ts';

export interface StoredOrderRecord extends OrderRecord {
  customerSessionId: string;
}

export interface StoredNotificationRecord extends NotificationItem {
  customerSessionId: string;
}

export interface StoredOwnerCredential {
  email: string;
  passwordHash: string;
  claimedAt: string;
}

interface BoutiqueStoreData {
  ownerCredential: StoredOwnerCredential | null;
  orders: StoredOrderRecord[];
  notifications: StoredNotificationRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.resolve(DATA_DIR, 'boutique-store.json');

if (!STORE_FILE.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid store file path');
}

function createEmptyStore(): BoutiqueStoreData {
  return {
    ownerCredential: null,
    orders: [],
    notifications: [],
  };
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): BoutiqueStoreData {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    const initial = createEmptyStore();
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<BoutiqueStoreData>;
    return {
      ownerCredential: parsed.ownerCredential ?? null,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    };
  } catch {
    return createEmptyStore();
  }
}

let state: BoutiqueStoreData = loadStore();

function persistStore(): void {
  ensureDataDir();
  const tmpFile = path.resolve(DATA_DIR, `boutique-store.${process.pid}.tmp`);
  if (!tmpFile.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temp store path');
  }
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, STORE_FILE);
}

export function sanitizeOrderForClient(stored: StoredOrderRecord): OrderRecord {
  const { customerSessionId: _omit, ...publicOrder } = stored;
  return publicOrder;
}

export function sanitizeNotificationForClient(stored: StoredNotificationRecord): NotificationItem {
  const { customerSessionId: _omit, ...publicNotification } = stored;
  return publicNotification;
}

export function getOwnerCredential(): StoredOwnerCredential | null {
  return state.ownerCredential;
}

export function setOwnerCredentialOnce(credential: StoredOwnerCredential): boolean {
  if (state.ownerCredential !== null) {
    return false;
  }
  state.ownerCredential = credential;
  persistStore();
  return true;
}

export function hasOrderReference(orderReference: string): boolean {
  return state.orders.some((o) => o.orderReference === orderReference);
}

export function insertOrder(order: StoredOrderRecord): void {
  state.orders.unshift(order);
  persistStore();
}

export function getOrdersByCustomer(customerSessionId: string): StoredOrderRecord[] {
  return state.orders
    .filter((o) => o.customerSessionId === customerSessionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getAllOrders(): StoredOrderRecord[] {
  return [...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getOrderById(orderId: string): StoredOrderRecord | undefined {
  return state.orders.find((o) => o.id === orderId);
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

export function getNotificationsByCustomer(customerSessionId: string): StoredNotificationRecord[] {
  return state.notifications
    .filter((n) => n.customerSessionId === customerSessionId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function markCustomerNotificationRead(
  customerSessionId: string,
  notificationId: string
): boolean {
  const target = state.notifications.find(
    (n) => n.id === notificationId && n.customerSessionId === customerSessionId
  );
  if (!target) return false;
  target.read = true;
  persistStore();
  return true;
}

export function markAllCustomerNotificationsRead(customerSessionId: string): void {
  let changed = false;
  for (const item of state.notifications) {
    if (item.customerSessionId === customerSessionId && !item.read) {
      item.read = true;
      changed = true;
    }
  }
  if (changed) {
    persistStore();
  }
}
