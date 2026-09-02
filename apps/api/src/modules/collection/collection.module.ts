import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionEntity } from './entities/collection.entity';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtAuthGuard } from '../product/optional-jwt.guard';

@Module({
  imports: [TypeOrmModule.forFeature([CollectionEntity]), AuthModule],
  controllers: [CollectionController],
  providers: [CollectionService, OptionalJwtAuthGuard],
  exports: [CollectionService],
})
export class CollectionModule {}
