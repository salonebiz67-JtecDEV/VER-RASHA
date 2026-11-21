/**
 * Device-Bound Authentication & Secure Storage Helper
 *
 * Web:
 *  - Long-lived owner auth token is held strictly in a server-issued HttpOnly cookie
 *    (never stored in localStorage/sessionStorage or readable by JavaScript).
 *  - Device cryptographic identity uses a non-extractable ECDSA P-256 CryptoKeyPair
 *    persisted in IndexedDB so copying cookies to another phone fails device binding.
 *
 * Capacitor Android:
 *  - Bridges to native Android Keystore storage via the OwnerSecureStorage Capacitor plugin.
 */

interface CapacitorOwnerStoragePlugin {
  getOrCreateDeviceIdentity(): Promise<{
    deviceId: string;
    publicKeyJwk?: JsonWebKey | null;
  }>;
  saveDeviceToken(options: { token: string }): Promise<void>;
  getDeviceToken(): Promise<{ token?: string | null }>;
  clearDeviceToken(): Promise<void>;
  signPayload(options: { payload: string }): Promise<{ signature: string }>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    OwnerSecureStorage?: CapacitorOwnerStoragePlugin;
  };
}

interface StoredDeviceIdentityRecord {
  deviceId: string;
  privateKey?: CryptoKey;
  publicKeyJwk?: JsonWebKey | null;
}

const IDB_NAME = 'vey_rasha_device_security';
const IDB_STORE = 'device_identity';
const IDB_KEY = 'primary_v1';

let memoryIdentityCache: StoredDeviceIdentityRecord | null = null;

function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

export function isCapacitorAndroid(): boolean {
  const cap = getCapacitor();
  return Boolean(cap?.isNativePlatform?.() && cap.getPlatform?.() === 'android');
}

function getNativePlugin(): CapacitorOwnerStoragePlugin | null {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.OwnerSecureStorage ?? null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function openIdentityDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readIdentityFromIdb(): Promise<StoredDeviceIdentityRecord | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openIdentityDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as StoredDeviceIdentityRecord) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeIdentityToIdb(record: StoredDeviceIdentityRecord): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openIdentityDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(record, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB storage errors cleanly
  }
}

export async function getOrCreateDeviceIdentity(): Promise<{
  deviceId: string;
  publicKeyJwk: JsonWebKey | null;
  platform: 'web' | 'android-capacitor';
  deviceLabel: string;
}> {
  const nativePlugin = getNativePlugin();
  if (nativePlugin) {
    const identity = await nativePlugin.getOrCreateDeviceIdentity();
    return {
      deviceId: identity.deviceId,
      publicKeyJwk: identity.publicKeyJwk ?? null,
      platform: 'android-capacitor',
      deviceLabel: 'Android Device (Keystore)',
    };
  }

  if (memoryIdentityCache) {
    return {
      deviceId: memoryIdentityCache.deviceId,
      publicKeyJwk: memoryIdentityCache.publicKeyJwk ?? null,
      platform: 'web',
      deviceLabel: buildBrowserDeviceLabel(),
    };
  }

  const existing = await readIdentityFromIdb();
  if (existing?.deviceId) {
    memoryIdentityCache = existing;
    return {
      deviceId: existing.deviceId,
      publicKeyJwk: existing.publicKeyJwk ?? null,
      platform: 'web',
      deviceLabel: buildBrowserDeviceLabel(),
    };
  }

  const deviceId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  let privateKey: CryptoKey | undefined;
  let publicKeyJwk: JsonWebKey | null = null;

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const pair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, // Non-extractable private key: cannot be copied off device
        ['sign', 'verify']
      );
      privateKey = pair.privateKey;
      publicKeyJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    } catch {
      privateKey = undefined;
      publicKeyJwk = null;
    }
  }

  const record: StoredDeviceIdentityRecord = {
    deviceId,
    privateKey,
    publicKeyJwk,
  };
  memoryIdentityCache = record;
  await writeIdentityToIdb(record);

  return {
    deviceId,
    publicKeyJwk,
    platform: 'web',
    deviceLabel: buildBrowserDeviceLabel(),
  };
}

function buildBrowserDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Web Browser';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'Android Browser';
  if (/iPhone|iPad/i.test(ua)) return 'iOS Safari';
  if (/Mac/i.test(ua)) return 'Desktop Browser (Mac)';
  if (/Windows/i.test(ua)) return 'Desktop Browser (Windows)';
  return 'Web Browser';
}

export async function saveNativeOwnerToken(token: string): Promise<void> {
  const nativePlugin = getNativePlugin();
  if (nativePlugin) {
    await nativePlugin.saveDeviceToken({ token });
  }
}

export async function clearNativeOwnerToken(): Promise<void> {
  const nativePlugin = getNativePlugin();
  if (nativePlugin) {
    await nativePlugin.clearDeviceToken();
  }
}

export async function getNativeOwnerToken(): Promise<string | null> {
  const nativePlugin = getNativePlugin();
  if (!nativePlugin) return null;
  try {
    const res = await nativePlugin.getDeviceToken();
    return res?.token ?? null;
  } catch {
    return null;
  }
}

export async function buildSignedOwnerHeaders(
  method: string,
  path: string
): Promise<Record<string, string>> {
  const identity = await getOrCreateDeviceIdentity();
  const timestamp = String(Date.now());
  const payload = `${method.toUpperCase()}:${path}:${timestamp}:${identity.deviceId}`;

  const headers: Record<string, string> = {
    'X-Requested-With': 'VEYRASHA-Client',
    'X-Device-Id': identity.deviceId,
    'X-Device-Timestamp': timestamp,
  };

  const nativePlugin = getNativePlugin();
  if (nativePlugin) {
    try {
      const token = await getNativeOwnerToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const { signature } = await nativePlugin.signPayload({ payload });
      if (signature) {
        headers['X-Device-Signature'] = signature;
      }
    } catch {
      // Fail closed on backend verification
    }
    return headers;
  }

  if (memoryIdentityCache?.privateKey && typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoded = new TextEncoder().encode(payload);
      const sigBuffer = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        memoryIdentityCache.privateKey,
        encoded
      );
      headers['X-Device-Signature'] = bytesToBase64Url(new Uint8Array(sigBuffer));
    } catch {
      // Fail closed on backend if key-bound
    }
  }

  return headers;
}
