import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { TorobBadRequest } from './torob-product-request';

@Catch()
export class TorobApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof TorobBadRequest) {
      return res.status(400).send({ error: exception.message });
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : typeof (body as { message?: unknown })?.message === 'string'
            ? String((body as { message: string }).message)
            : status === HttpStatus.UNAUTHORIZED
              ? 'توکن ترب نامعتبر است'
              : 'خطای درخواست ترب';
      return res.status(status).send({ error: message });
    }
    return res.status(500).send({ error: 'خطای داخلی سرویس ترب' });
  }
}
