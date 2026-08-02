import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogPostEntity } from './entities/blog-post.entity';
import { BlogCategoryEntity } from './entities/blog-category.entity';
import { BlogTagEntity } from './entities/blog-tag.entity';
import { BlogAuthorEntity } from './entities/blog-author.entity';
import { SeoRedirectEntity } from './entities/seo-redirect.entity';
import { BlogSettingsEntity } from './entities/blog-settings.entity';
import { SeoAuditLogEntity } from './entities/seo-audit-log.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { BlogService } from './blog.service';
import { BlogController } from './blog.controller';
import { AuthModule } from '../auth/auth.module';
import { BlogPermissionsGuard } from '../auth/guards/blog-permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BlogPostEntity,
      BlogCategoryEntity,
      BlogTagEntity,
      BlogAuthorEntity,
      SeoRedirectEntity,
      BlogSettingsEntity,
      SeoAuditLogEntity,
      UserEntity,
    ]),
    AuthModule,
  ],
  controllers: [BlogController],
  providers: [BlogService, BlogPermissionsGuard],
  exports: [BlogService],
})
export class BlogModule {}
