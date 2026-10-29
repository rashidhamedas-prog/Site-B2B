/**
 * npx ts-node --transpile-only src/modules/omnichannel/adapters/telegram-errors.spec.ts
 */
import {
  classifyTelegramHttpError,
  classifyTelegramThrow,
  isNonRetryableProviderError,
  redactProviderError,
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

const tgTok = '123456789:AA-fake-telegram-token-XXXXXX';
const baleTok = '987654321:bale-test-token-not-real';
const rubikaTok = 'RUBIKA-test-token-not-real-ABCDEF';
assert(!redactProviderError(`/bot${tgTok}/sendMessage`).includes(tgTok), 'redact TG /bot path');
assert(!redactProviderError(`/bot${baleTok}/getMe`).includes(baleTok), 'redact Bale /bot path');
assert(!redactProviderError(`https://botapi.rubika.ir/v3/${rubikaTok}/getMe`).includes(rubikaTok), 'redact Rubika /v3 path');
assert(redactProviderError(`token ${tgTok} leaked`).includes('[redacted-token]'), 'redact digits:secret shape');

console.log('telegram-errors.spec.ts: ok');
