import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { swaggerEnabled } from './bootstrap-flags';
import { SmsCooldownExceptionFilter } from './modules/notification/sms-cooldown-http';
import { ConfigService } from '@nestjs/config';
import type { DataSourceOptions } from 'typeorm';
import { databaseConfig, migrationRunnerEnabled } from './config/database.config';
import { runMigrationsWithLock } from './database/run-migrations';
import { MAX_UPLOAD_IMAGE_BYTES } from './modules/upload/upload-image-policy';

async function bootstrap() {
  if (migrationRunnerEnabled()) {
    const env = { get: (key: string, fallback?: unknown) => process.env[key] ?? fallback } as unknown as ConfigService;
    await runMigrationsWithLock(databaseConfig(env) as DataSourceOptions);
  }

  // Trust one reverse-proxy hop (nginx) so Fastify request.ip is derived safely.
  // Do not parse raw x-forwarded-for in application code — use extractClientIp(req).
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: 1, ignoreTrailingSlash: true })
  );

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',');
  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // Scoped to SmsCooldownException only — adds Retry-After next to the JSON body.
  app.useGlobalFilters(new SmsCooldownExceptionFilter());

  // Register multipart for file uploads.
  // throwFileSizeLimit defaults to true, but busboy still ends the stream at fileSize
  // and only sets `file.truncated`. The upload controller rejects that flag. The previous
  // 5 MiB cap stored exactly 5242880 bytes and dropped the JPEG EOI marker.
  await app.register(require('@fastify/multipart'), {
    limits: { fileSize: MAX_UPLOAD_IMAGE_BYTES, files: 1 },
    throwFileSizeLimit: true,
  });

  if (swaggerEnabled()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Taranom API')
      .setDescription('پوشاک ترنم — سامانه مدیریت عمده‌فروشی')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const fastify = app.getHttpAdapter().getInstance();
  fastify.get('/v1/health', async () => ({ status: 'ok', service: 'taranom-api', version: '1.0' }));

  /**
   * Controlled non-production identity challenge for E2E.
   * deploymentId comes from DEPLOYMENT_IDENTITY set at environment provision — not client-forgeable.
   * Returns 404 when APP_ENV is production / unset / unknown.
   */
  fastify.get('/v1/env-identity', async (_req, reply) => {
    const appEnv = String(process.env.APP_ENV || '')
      .trim()
      .toLowerCase();
    const deploymentId = String(process.env.DEPLOYMENT_IDENTITY || '').trim();
    const allowed = new Set(['staging', 'local', 'disposable']);
    if (!allowed.has(appEnv) || !deploymentId) {
      return reply.code(404).send({ statusCode: 404, message: 'Not Found' });
    }
    return {
      deploymentId,
      environment: appEnv,
      nonProduction: true,
    };
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Taranom API running on http://localhost:${port}`);
}

bootstrap();
