import 'dotenv/config';
import {
  emergencyRecoverOwnerSlots,
  sha256Hex,
  timingSafeHexEqual,
} from './store.ts';

/**
 * VEY RASHA Backend Emergency Recovery Procedure
 *
 * Usage (server / SSH / Render shell only — never exposed as a public UI button):
 *   OWNER_RECOVERY_SECRET_INPUT="<your secret>" npm run owner:recover -- all
 *   OWNER_RECOVERY_SECRET_INPUT="<your secret>" npm run owner:recover -- 1
 *   OWNER_RECOVERY_SECRET_INPUT="<your secret>" npm run owner:recover -- 2
 */
function runRecovery(): void {
  const configuredSecret = process.env.OWNER_RECOVERY_SECRET?.trim() || '';
  const providedSecret = process.env.OWNER_RECOVERY_SECRET_INPUT?.trim() || '';

  if (!configuredSecret) {
    console.error(
      'Recovery aborted: OWNER_RECOVERY_SECRET is not configured in the backend environment.'
    );
    process.exit(1);
  }

  if (!providedSecret || !timingSafeHexEqual(sha256Hex(providedSecret), sha256Hex(configuredSecret))) {
    console.error('Recovery aborted: invalid backend recovery secret.');
    process.exit(1);
  }

  const arg = (process.argv[2] || 'all').trim().toLowerCase();
  const targetSlot: 1 | 2 | 'all' = arg === '1' ? 1 : arg === '2' ? 2 : 'all';

  emergencyRecoverOwnerSlots(targetSlot);
  console.log(
    `VEY RASHA emergency recovery complete for slot=${String(targetSlot)}. Rotate OWNER_ENROLLMENT_CODE_1/2 and restart the backend server before re-enrolling replacement devices.`
  );
}

runRecovery();
