/**
 * npx ts-node --transpile-only src/modules/omnichannel/adapters/telegram-errors.spec.ts
 */
import {
  classifyTelegramHttpError,
  classifyTelegramThrow,
  isNonRetryableProviderError,
} from './telegram-errors';
import { shouldDeadLetter } from '../services/outbox-lease';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(classifyTelegramHttpError(400, 'Bad Request: UNSUPPORTED_FILE') === 'unsupported_media', 'UNSUPPORTED_FILE');
assert(classifyTelegramHttpError(400, 'file too large') === 'unsupported_media', 'file too large');
assert(classifyTelegramThrow({ telegramCode: 'unsupported_media', message: 'unsupported_media' }) === 'unsupported_media', 'named code');

assert(isNonRetryableProviderError(new Error('unsupported_media')) === true, 'unsupported_media is non-retryable');
assert(
  isNonRetryableProviderError({ telegramCode: 'unsupported_media', message: 'x' }) === true,
  'telegramCode unsupported_media is non-retryable',
);
assert(isNonRetryableProviderError(new Error('rate_limited')) === false, 'rate_limited still retryable');
assert(isNonRetryableProviderError(new Error('validate_failed')) === false, 'validate_failed still retryable');

assert(
  shouldDeadLetter(1, 8, { forceDead: isNonRetryableProviderError(new Error('unsupported_media')) }) === true,
  'worker path: unsupported_media → DEAD on first failure',
);
assert(
  shouldDeadLetter(1, 8, { forceDead: isNonRetryableProviderError(new Error('timeout')) }) === false,
  'timeout does not force DEAD via this helper',
);

console.log('telegram-errors.spec.ts: ok');
