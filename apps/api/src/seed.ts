import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

/**
 * Creates the first ADMIN user when none exists.
 *
 * Production (NODE_ENV=production):
 *   Requires SEED_ADMIN_PHONE + SEED_ADMIN_PASSWORD (min 12 chars).
 *   Fails closed if either is missing — never uses a hardcoded default.
 *
 * Development:
 *   Uses SEED_ADMIN_* when set; otherwise generates a one-time random password
 *   and prints it once to stdout (not suitable for shared logs).
 */
async function seed() {
  const isProd = process.env.NODE_ENV === 'production';
  const phoneEnv = process.env.SEED_ADMIN_PHONE?.trim();
  const passwordEnv = process.env.SEED_ADMIN_PASSWORD;

  if (isProd) {
    if (!phoneEnv || !passwordEnv) {
      console.error(
        'Seed refused: in production set SEED_ADMIN_PHONE and SEED_ADMIN_PASSWORD (min 12 chars).',
      );
      process.exit(1);
    }
    if (passwordEnv.length < 12) {
      console.error('Seed refused: SEED_ADMIN_PASSWORD must be at least 12 characters.');
      process.exit(1);
    }
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(getDataSourceToken());
  const userRepo = dataSource.getRepository('UserEntity');

  const existing = await userRepo.findOne({ where: { role: 'ADMIN' } });
  if (existing) {
    console.log('Admin already exists, skipping seed.');
    await app.close();
    return;
  }

  const phone = phoneEnv || '09120000000';
  const password = passwordEnv || randomBytes(18).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);

  await userRepo.save(
    userRepo.create({
      phone,
      email: process.env.SEED_ADMIN_EMAIL || undefined,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    }),
  );

  console.log(`Admin created: phone=${phone}`);
  if (!passwordEnv) {
    console.log(`One-time password (save now, will not be shown again): ${password}`);
  } else {
    console.log('Password taken from SEED_ADMIN_PASSWORD (not printed).');
  }
  console.log('Change the password immediately after first login.');

  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
