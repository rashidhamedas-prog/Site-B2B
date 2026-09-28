import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

export const SMS_COOLDOWN_MESSAGE = 'لطفاً کمی صبر کنید و دوباره درخواست کد دهید';

/** Uniform 429 body for every SMS/OTP resend cooldown block. */
export function smsCooldownPayload(
  remainingSeconds: number,
  cooldownSeconds: number,
  message: string = SMS_COOLDOWN_MESSAGE,
) {
  return {
    message,
    remainingSeconds,
    cooldownSeconds,
    code: 'SMS_COOLDOWN',
  };
}

/** Express (`setHeader`) and Fastify (`header`) replies are both accepted. */
type HeaderWritable =
  | { setHeader(name: string, value: string): unknown }
  | { header(name: string, value: string): unknown };

export function applyRetryAfter(res: HeaderWritable, remainingSeconds: number) {
  const value = String(Math.max(1, Math.ceil(remainingSeconds)));
  const target = res as Partial<Record<'setHeader' | 'header', (n: string, v: string) => unknown>>;
  if (typeof target.setHeader === 'function') target.setHeader('Retry-After', value);
  else if (typeof target.header === 'function') target.header('Retry-After', value);
}

export class SmsCooldownException extends HttpException {
  constructor(
    readonly remainingSeconds: number,
    readonly cooldownSeconds: number,
    message: string = SMS_COOLDOWN_MESSAGE,
  ) {
    super(smsCooldownPayload(remainingSeconds, cooldownSeconds, message), HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * Only adds `Retry-After` to SmsCooldownException — every other error keeps
 * the default Nest handling.
 */
@Catch(SmsCooldownException)
export class SmsCooldownExceptionFilter implements ExceptionFilter {
  catch(exception: SmsCooldownException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    applyRetryAfter(res, exception.remainingSeconds);
    res.status(exception.getStatus()).send(exception.getResponse());
  }
}
