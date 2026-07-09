import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingEntity } from './entities/app-setting.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AuthModule } from '../auth/auth.module';

// Global: shipping/notification/payment services inject SettingsService
// without each module importing SettingsModule explicitly.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AppSettingEntity]), AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
