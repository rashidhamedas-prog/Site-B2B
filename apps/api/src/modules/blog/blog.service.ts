import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { BlogPostEntity } from './entities/blog-post.entity';

function slugify(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^؀-ۿa-zA-Z0-9-]/g, '')
    .toLowerCase();
}

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly repo: Repository<BlogPostEntity>,
  ) {}

  // Public: published posts only.
  async findPublished(opts: { page?: number; limit?: number; category?: string; search?: string }) {
    // Number() guards against NaN from missing/invalid query params
    // (ValidationPipe implicit conversion turns absent params into NaN).
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(50, Number(opts.limit) || 12);
    const where: any = { status: 'PUBLISHED' };
    if (opts.category) where.category = opts.category;
    if (opts.search) where.title = ILike(`%${opts.search}%`);
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findBySlug(slug: string): Promise<BlogPostEntity> {
    const post = await this.repo.findOne({ where: { slug, status: 'PUBLISHED' } });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    // Fire-and-forget view counter.
    this.repo.increment({ id: post.id }, 'views', 1).catch(() => undefined);
    return post;
  }

  // Admin: all posts including drafts.
  async findAllAdmin() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async create(data: Partial<BlogPostEntity>): Promise<BlogPostEntity> {
    const slug = data.slug ? slugify(data.slug) : slugify(data.title ?? '');
    const exists = await this.repo.findOne({ where: { slug }, withDeleted: true });
    if (exists) throw new ConflictException('اسلاگ تکراری است');
    const post = this.repo.create({
      ...data,
      slug,
      publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
    } as Partial<BlogPostEntity>);
    return this.repo.save(post);
  }

  async update(id: string, data: Partial<BlogPostEntity>): Promise<BlogPostEntity> {
    const post = await this.repo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    if (data.slug) data.slug = slugify(data.slug);
    // Stamp publishedAt on first publish.
    if (data.status === 'PUBLISHED' && post.status !== 'PUBLISHED') {
      data.publishedAt = new Date();
    }
    Object.assign(post, data);
    return this.repo.save(post);
  }

  async remove(id: string) {
    const res = await this.repo.softDelete(id);
    if (!res.affected) throw new NotFoundException('مطلب یافت نشد');
    return { deleted: true };
  }

  async categories(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('p')
      .select('DISTINCT p.category', 'category')
      .where("p.status = 'PUBLISHED'")
      .getRawMany();
    return rows.map((r) => r.category).filter(Boolean);
  }
}
