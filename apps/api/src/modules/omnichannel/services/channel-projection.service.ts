import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from '../../product/entities/product.entity';
import { BlogPostEntity } from '../../blog/entities/blog-post.entity';
import { CmsPageEntity } from '../../cms/entities/cms-page.entity';
import { buildChannelProjection, type ChannelProjection } from '../../product/channel-projection';
import { buildBlogProjection, buildCmsProjection, type ContentProjection } from '../content-projection';
import type { SalesChannel } from '../../product/channel-product-projection';

export type AnyProjection = ChannelProjection | ContentProjection;

@Injectable()
export class ChannelProjectionService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(BlogPostEntity)
    private readonly posts: Repository<BlogPostEntity>,
    @InjectRepository(CmsPageEntity)
    private readonly pages: Repository<CmsPageEntity>,
  ) {}

  async previewProduct(sourceId: string, channel: SalesChannel): Promise<ChannelProjection> {
    const product = await this.products.findOne({
      where: { id: sourceId },
      relations: ['variants'],
    });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    return buildChannelProjection(product, channel);
  }

  async previewBlog(sourceId: string, channel: SalesChannel): Promise<ContentProjection> {
    const post = await this.posts.findOne({ where: { id: sourceId } });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    return buildBlogProjection(post, channel);
  }

  async previewCms(sourceId: string, channel: SalesChannel): Promise<ContentProjection> {
    const page = await this.pages.findOne({ where: { id: sourceId } });
    if (!page) throw new NotFoundException('صفحه یافت نشد');
    return buildCmsProjection(page, channel);
  }

  async previewSource(sourceType: string, sourceId: string, channel: SalesChannel): Promise<AnyProjection> {
    const kind = String(sourceType || 'PRODUCT').toUpperCase();
    if (kind === 'BLOG_POST') return this.previewBlog(sourceId, channel);
    if (kind === 'CMS_PAGE') return this.previewCms(sourceId, channel);
    if (kind === 'PRODUCT') return this.previewProduct(sourceId, channel);
    throw new NotFoundException('نوع منبع پشتیبانی نمی‌شود');
  }
}
