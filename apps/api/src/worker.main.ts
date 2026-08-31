import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './modules/omnichannel/worker.module';

process.env.OMNICHANNEL_WORKER = 'true';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
