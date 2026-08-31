/**
 * npx ts-node --transpile-only src/modules/rma/rma-audit-runtime.spec.ts
 */
import { RUNTIME_TYPEORM_ENTITIES } from '../../config/database.config';
import { ReturnRequestAuditEntity } from './entities/return-request-audit.entity';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  RUNTIME_TYPEORM_ENTITIES.includes(ReturnRequestAuditEntity),
  'ReturnRequestAuditEntity must be on the runtime TypeORM list',
);

console.log('rma-audit-runtime.spec.ts: ok');
