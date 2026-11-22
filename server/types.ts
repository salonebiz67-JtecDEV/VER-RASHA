export type OwnerDeviceSlot = 1 | 2;

export interface OwnerDeviceSummary {
  slot: OwnerDeviceSlot;
  deviceId: string;
  deviceLabel: string;
  platform: 'web' | 'android-capacitor';
  keyBound: boolean;
  enrolledAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  isCurrentDevice?: boolean;
}

export type OwnerAuditEventType =
  | 'ENROLLMENT_SUCCESS'
  | 'ENROLLMENT_DENIED'
  | 'ENROLLMENT_LOCKOUT'
  | 'AUTH_FAILURE'
  | 'TOKEN_ROTATED'
  | 'DEVICE_REVOKED'
  | 'REPLACEMENT_CODE_CREATED'
  | 'EMERGENCY_RECOVERY';

export interface OwnerSecurityAuditEntry {
  id: string;
  timestamp: string;
  eventType: OwnerAuditEventType;
  slot?: OwnerDeviceSlot;
  deviceId?: string;
  deviceLabel?: string;
  ipHash?: string;
  detail: string;
}

export interface OwnerSecuritySummary {
  maxDevices: 2;
  activeDeviceCount: number;
  enrollmentOpen: boolean;
  slot1EnvConfigured: boolean;
  slot2EnvConfigured: boolean;
  slot1Consumed: boolean;
  slot2Consumed: boolean;
  activeReplacementCode: {
    targetSlot: OwnerDeviceSlot;
    expiresAt: string;
  } | null;
  devices: OwnerDeviceSummary[];
  auditLogs: OwnerSecurityAuditEntry[];
}
