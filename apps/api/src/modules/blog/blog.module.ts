import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogPostEntity } from './entities/blog-post.entity';
import { BlogCategoryEntity } from './entities/blog-category.entity';
import { BlogTagEntity } from './entities/blog-tag.entity';
import { BlogAuthorEntity } from './entities/blog-author.entity';
import { SeoRedirectEntity } from './entities/seo-redirect.entity';
import { BlogSettingsEntity } from './entities/blog-settings.entity';
import { SeoAuditLogEntity } from './entities/seo-audit-log.entity';
import { BlogMediaAssetEntity } from './entities/blog-media-asset.entity';
import { BlogArticleRevisionEntity } from './entities/blog-article-revision.entity';
import { BlogCommentEntity } from './entities/blog-comment.entity';
import { BlogAnalyticsEntity } from './entities/blog-analytics.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { ProductEntity } from '../product/entities/product.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { BlogService } from './blog.service';
import { BlogExtrasService } from './blog-extras.service';
import { BlogSchedulerService } from './blog-scheduler.service';
import { BlogController } from './blog.controller';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';
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
      BlogMediaAssetEntity,
      BlogArticleRevisionEntity,
      BlogCommentEntity,
      BlogAnalyticsEntity,
      UserEntity,
      ProductEntity,
      ProductVariantEntity,
    ]),
    AuthModule,
    UploadModule,
  ],
  controllers: [BlogController],
  providers: [BlogService, BlogExtrasService, BlogSchedulerService, BlogPermissionsGuard],
  exports: [BlogService, BlogExtrasService],
})
export class BlogModule {}
