import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',');
  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Register multipart for file uploads
  await app.register(require('@fastify/multipart'), {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Taranom API')
    .setDescription('پوشاک ترنم — سامانه مدیریت عمده‌فروشی')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const fastify = app.getHttpAdapter().getInstance();
  fastify.get('/v1/health', async () => ({ status: 'ok', service: 'taranom-api', version: '1.0' }));

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Taranom API running on http://localhost:${port}`);
}

bootstrap();
