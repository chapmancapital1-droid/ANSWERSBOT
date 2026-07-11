import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { captureException } from '../sentry';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId =
      req.requestId ||
      (req.headers['x-request-id'] as string) ||
      'unknown';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    if (status >= 500) {
      this.log.error(
        `[${requestId}] ${req.method} ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      captureException(exception, {
        requestId,
        path: req.url,
        method: req.method,
      });
    } else {
      this.log.warn(
        `[${requestId}] ${req.method} ${req.url} → ${status}`,
      );
    }

    const payload =
      typeof body === 'string'
        ? { statusCode: status, message: body, requestId }
        : { ...(body as object), statusCode: status, requestId };

    res.status(status).json(payload);
  }
}
