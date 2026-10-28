/**
 * Source + pure-gate tests for PR-7 delete service.
 * npx ts-node --transpile-only src/modules/omnichannel/services/omnichannel-delete.service.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  GO_REF_REQUIRED_MESSAGE,
  assertDeleteEditEnabled,
  assertOwnerGoRefForDelete,
  isOmnichannelDeleteEditEnabled,
} from '../omnichannel-delete-edit-rbac';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function src(name: string) {
  return readFileSync(resolve(__dirname, name), 'utf8');
}

const deleteSrc = src('omnichannel-delete.service.ts');
const editSrc = src('omnichannel-edit.service.ts');
const ctl = readFileSync(resolve(__dirname, '../controllers/omnichannel-admin.controller.ts'), 'utf8');

assert(deleteSrc.includes('pre_delete'), 'backup kind pre_delete');
assert(deleteSrc.includes('confirmSku') || deleteSrc.includes('assertConfirmSku'), 'SKU confirm');
assert(deleteSrc.includes('delete_window_expired'), 'Bale window');
assert(deleteSrc.includes('deleteWindowHours'), 'delete plan exposes deleteWindowHours');
assert(deleteSrc.includes('connectors_disabled') || deleteSrc.includes('areOmnichannelConnectorsEnabled'), 'connector gate');
{
  const dbCfg = readFileSync(resolve(__dirname, '../../../config/database.config.ts'), 'utf8');
  assert(dbCfg.includes('OmnichannelPostBackupEntity'), 'RUNTIME registers PostBackup');
  assert(dbCfg.includes('OmnichannelDeliveryMessageEntity'), 'RUNTIME registers DeliveryMessage');
}
assert(deleteSrc.includes('withdrawPublication'), 'withdraw pipeline');
assert(editSrc.includes('delivery_revert') || editSrc.includes('revert'), 'revert path');
assert(ctl.includes('deliveries/:deliveryId/delete-plan'), 'delete-plan route');
assert(ctl.includes('deliveries/:deliveryId/messages/delete'), 'messages delete route');
assert(ctl.includes('deliveries/:deliveryId/edit'), 'edit route');
assert(ctl.includes('deliveries/:deliveryId/revert'), 'revert route');

{
  const prev = process.env.OMNICHANNEL_DELETE_EDIT_ENABLED;
  delete process.env.OMNICHANNEL_DELETE_EDIT_ENABLED;
  assert(isOmnichannelDeleteEditEnabled() === false, 'flag default off');
  try {
    assertDeleteEditEnabled();
    throw new Error('expected disabled throw');
  } catch (err: unknown) {
    assert(
      (err as { statusCode?: number }).statusCode === 503
        || String((err as Error).message || err).includes('غیرفعال'),
      '503 when disabled',
    );
  }
  process.env.OMNICHANNEL_DELETE_EDIT_ENABLED = 'true';
  assert(isOmnichannelDeleteEditEnabled() === true, 'flag on');
  if (prev === undefined) delete process.env.OMNICHANNEL_DELETE_EDIT_ENABLED;
  else process.env.OMNICHANNEL_DELETE_EDIT_ENABLED = prev;
}

{
  const prev = process.env.OMNICHANNEL_RBAC_ENABLED;
  process.env.OMNICHANNEL_RBAC_ENABLED = 'true';
  try {
    assertOwnerGoRefForDelete({ id: 'u1', omnichannelRole: 'OWNER' }, '');
    throw new Error('expected goRef 400');
  } catch (err: unknown) {
    assert(
      String((err as Error).message || err).includes('goRef')
        || String((err as Error).message || err).includes(GO_REF_REQUIRED_MESSAGE)
        || String((err as { message?: string }).message || '').includes('تأیید'),
      'goRef required',
    );
  }
  try {
    assertOwnerGoRefForDelete({ id: 'u1', omnichannelRole: 'PUBLISHER' }, 'GO حامد');
    throw new Error('expected publisher 403');
  } catch (err: unknown) {
    assert(
      (err as { statusCode?: number }).statusCode === 403
        || String((err as Error).message || '').includes('Owner'),
      'publisher cannot delete',
    );
  }
  const ok = assertOwnerGoRefForDelete({ id: 'u1', omnichannelRole: 'OWNER' }, 'GO حامد 2026-10-28');
  assert(ok === 'GO حامد 2026-10-28', 'owner+goRef ok');
  if (prev === undefined) delete process.env.OMNICHANNEL_RBAC_ENABLED;
  else process.env.OMNICHANNEL_RBAC_ENABLED = prev;
}

console.log('omnichannel-delete.service.spec.ts: ok');
