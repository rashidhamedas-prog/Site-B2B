import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import * as bcrypt from 'bcryptjs';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(getDataSourceToken());

  const userRepo = dataSource.getRepository('UserEntity');

  // Create default admin if none exists
  const existing = await userRepo.findOne({ where: { role: 'ADMIN' } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('Admin@1234', 12);
    await userRepo.save(userRepo.create({
      phone: '09152424624',
      email: 'rashidhamedas@gmail.com',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    }));
    console.log('✅ Admin created: phone=09152424624, password=Admin@1234');
    console.log('⚠️  Change the password immediately after first login!');
  } else {
    console.log('ℹ️  Admin already exists, skipping seed.');
  }

  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
