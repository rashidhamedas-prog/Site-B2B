import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { requirePublicBlogChannel } from './blog-public-channel';
import { BlogService } from './blog.service';
import { BlogExtrasService } from './blog-extras.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BlogPermissionsGuard } from '../auth/guards/blog-permissions.guard';
import { RequireBlogPermissions } from '../auth/decorators/blog-permissions.decorator';
import {
  CreateBlogPostDto,
  UpdateBlogPostDto,
  DeleteBlogPostDto,
  ImportBlogDto,
  CreateCategoryDto,
  CreateTagDto,
  CreateRedirectDto,
  CreateAuthorDto,
  TransitionDto,
} from './dto/blog.dto';
import { BLOG_ROLES, isBlogRole, type BlogRole } from './blog-roles';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../auth/entities/user.entity';
import { extractClientIp } from '../../common/client-ip';

function mapPublicBlogChannelError(err: unknown): never {
  if (err instanceof Error && err.message === 'PUBLIC_CHANNEL_REQUIRED') {
    throw new BadRequestException('کانال نامعتبر است');
  }
  throw err;
}

type AuthedRequest = Request & {
  user?: { id?: string; sub?: string; role?: string };
  blogUser?: {
    id?: string;
    role?: string;
    blogRole?: string | null;
    effectiveBlogRole?: BlogRole | null;
  };
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
};

@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(
    private readonly svc: BlogService,
    private readonly extras: BlogExtrasService,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>
  ) {}

  private actor(req: AuthedRequest) {
    if (req.blogUser) {
      return {
        id: req.blogUser.id,
        role: req.blogUser.role,
        blogRole: req.blogUser.blogRole,
        effectiveBlogRole: (req.blogUser.effectiveBlogRole as BlogRole | null) ?? null,
      };
    }
    const id = req.user?.id || req.user?.sub;
    return {
      id,
      role: req.user?.role,
      blogRole: null as string | null,
      effectiveBlogRole: null as BlogRole | null,
    };
  }

  // ── Public ────────────────────────────────────────────────

  @Get('posts')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  findPublished(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('category') category?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('tag') tag?: string,
    @Query('search') search?: string,
    @Query('channel') channel?: string
  ) {
    return this.svc
      .findPublished({ page, limit, category, categorySlug, tag, search, channel })
      .catch(mapPublicBlogChannelError);
  }

  @Get('categories')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  categories(@Query('channel') channel?: string) {
    try {
      return this.svc.listCategories(requirePublicBlogChannel(channel));
    } catch (err) {
      mapPublicBlogChannelError(err);
    }
  }

  @Get('categories/:slug')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  async categoryBySlug(@Param('slug') slug: string, @Query('channel') channel?: string) {
    try {
      const category = await this.svc.getCategoryBySlug(slug, channel);
      const { items, meta } = await this.svc.findPublished({
        channel,
        categorySlug: slug,
        limit: 12,
        page: 1,
      });
      return { category, items, meta };
    } catch (err) {
      mapPublicBlogChannelError(err);
    }
  }

  @Get('tags')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  tags(@Query('channel') channel?: string) {
    try {
      return this.svc.listTags(requirePublicBlogChannel(channel));
    } catch (err) {
      mapPublicBlogChannelError(err);
    }
  }

  @Get('tags/:slug')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  async tagBySlug(@Param('slug') slug: string, @Query('channel') channel?: string) {
    try {
      const tag = await this.svc.getTagBySlug(slug, channel);
      const { items, meta } = await this.svc.findPublished({
        channel,
        tag: tag.name || slug,
        limit: 12,
        page: 1,
      });
      return { tag, items, meta };
    } catch (err) {
      mapPublicBlogChannelError(err);
    }
  }

  @Get('search')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  searchPublic(
    @Query('q') q = '',
    @Query('channel') channel?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.svc
      .findPublished({
        channel,
        search: q,
        page,
        limit: Math.min(24, Number(limit) || 12),
      })
      .catch(mapPublicBlogChannelError);
  }

  @Get('feed')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  async feed(@Query('channel') channel?: string, @Query('limit') limit?: number) {
    return this.svc.feed(channel as string, Number(limit) || 20).catch(mapPublicBlogChannelError);
  }

  @Get('sitemap-posts')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  sitemapPosts(@Query('channel') channel?: string) {
    return this.svc.sitemapPosts(channel as string).catch(mapPublicBlogChannelError);
  }

  @Get('posts/:slug/seo')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  postSeo(@Param('slug') slug: string, @Query('channel') channel?: string) {
    return this.svc.getPublicSeoBundle(slug, channel as string).catch(mapPublicBlogChannelError);
  }

  @Get('posts/:slug')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  findBySlug(@Param('slug') slug: string, @Query('channel') channel?: string) {
    return this.svc.findBySlug(slug, channel).catch(mapPublicBlogChannelError);
  }

  @Get('redirects/match')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  matchRedirect(@Query('channel') channel: string, @Query('path') path: string) {
    return this.svc.matchRedirect(channel, path).catch(mapPublicBlogChannelError);
  }

  // ── Admin posts ───────────────────────────────────────────

  @Get('admin/posts')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  findAllAdmin(
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('authorId') authorId?: string
  ) {
    return this.svc.findAllAdmin({ channel, status, categoryId, search, authorId });
  }

  @Get('admin/posts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  findOneAdmin(@Param('id') id: string) {
    return this.svc.findOneAdmin(id);
  }

  @Post('admin/posts')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:create')
  @ApiBearerAuth()
  create(@Body() body: CreateBlogPostDto, @Req() req: AuthedRequest) {
    return this.svc.create(body, this.actor(req));
  }

  @Put('admin/posts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:edit_any', 'blog:edit_own')
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() body: UpdateBlogPostDto, @Req() req: AuthedRequest) {
    return this.svc.update(id, body, this.actor(req));
  }

  @Patch('admin/posts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:edit_any', 'blog:edit_own')
  @ApiBearerAuth()
  patch(@Param('id') id: string, @Body() body: UpdateBlogPostDto, @Req() req: AuthedRequest) {
    return this.svc.update(id, body, this.actor(req));
  }

  @Post('admin/posts/:id/:action')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions(
    'blog:publish',
    'blog:approve',
    'blog:reject',
    'blog:submit_review',
    'blog:schedule',
    'blog:delete_soft'
  )
  @ApiBearerAuth()
  async transition(
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: TransitionDto,
    @Req() req: AuthedRequest
  ) {
    if (action === 'duplicate') {
      return this.svc.duplicate(id, this.actor(req));
    }
    if (action === 'restore') {
      return this.svc.restore(id, this.actor(req));
    }
    if (action === 'schedule' && body.publishAt) {
      await this.svc.update(
        id,
        { publishAt: body.publishAt, status: 'SCHEDULED' },
        this.actor(req)
      );
    }
    return this.svc.transition(id, action, this.actor(req), body?.note);
  }

  @Delete('admin/posts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:delete_soft', 'blog:delete_hard')
  @ApiBearerAuth()
  remove(@Param('id') id: string, @Body() body: DeleteBlogPostDto, @Req() req: AuthedRequest) {
    return this.svc.remove(id, body || {}, this.actor(req));
  }

  @Post('admin/import')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:import')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ورود مقاله از JSON یا Markdown' })
  import(@Body() body: ImportBlogDto, @Req() req: AuthedRequest) {
    return this.svc.importArticle(body, this.actor(req));
  }

  @Get('admin/posts/:id/export')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:export', 'blog:read')
  @ApiBearerAuth()
  exportPost(@Param('id') id: string) {
    return this.svc.exportArticle(id);
  }

  @Post('admin/check-links')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_seo', 'blog:read')
  @ApiBearerAuth()
  checkLinks(@Body() body: { channel: string; content?: string; articleId?: string }) {
    return this.extras.checkLinks(body);
  }

  // ── Admin taxonomy ────────────────────────────────────────

  @Get('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  adminCategories(@Query('channel') channel?: string) {
    return this.svc.listCategories(channel);
  }

  @Post('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_categories')
  @ApiBearerAuth()
  createCategory(@Body() body: CreateCategoryDto, @Req() req: AuthedRequest) {
    return this.svc.createCategory(body, this.actor(req));
  }

  @Patch('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_categories')
  @ApiBearerAuth()
  updateCategory(
    @Param('id') id: string,
    @Body() body: Partial<CreateCategoryDto>,
    @Req() req: AuthedRequest
  ) {
    return this.svc.updateCategory(id, body, this.actor(req));
  }

  @Delete('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_categories')
  @ApiBearerAuth()
  removeCategory(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.removeCategory(id, this.actor(req));
  }

  @Get('admin/tags')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  adminTags(@Query('channel') channel?: string) {
    return this.svc.listTags(channel);
  }

  @Post('admin/tags')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_tags')
  @ApiBearerAuth()
  createTag(@Body() body: CreateTagDto, @Req() req: AuthedRequest) {
    return this.svc.createTag(body, this.actor(req));
  }

  @Patch('admin/tags/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_tags')
  @ApiBearerAuth()
  updateTag(
    @Param('id') id: string,
    @Body() body: Partial<CreateTagDto>,
    @Req() req: AuthedRequest
  ) {
    return this.svc.updateTag(id, body, this.actor(req));
  }

  @Delete('admin/tags/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_tags')
  @ApiBearerAuth()
  removeTag(@Param('id') id: string) {
    return this.svc.removeTag(id);
  }

  // ── Redirects / settings / roles ──────────────────────────

  @Get('admin/redirects')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_redirects', 'blog:read')
  @ApiBearerAuth()
  listRedirects(@Query('channel') channel?: string) {
    return this.svc.listRedirects(channel);
  }

  @Post('admin/redirects')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_redirects')
  @ApiBearerAuth()
  createRedirect(@Body() body: CreateRedirectDto, @Req() req: AuthedRequest) {
    return this.svc.createRedirect(body, this.actor(req));
  }

  @Patch('admin/redirects/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_redirects')
  @ApiBearerAuth()
  updateRedirect(
    @Param('id') id: string,
    @Body() body: Partial<CreateRedirectDto> & { isActive?: boolean }
  ) {
    return this.svc.updateRedirect(id, body);
  }

  @Delete('admin/redirects/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_redirects')
  @ApiBearerAuth()
  removeRedirect(@Param('id') id: string) {
    return this.svc.removeRedirect(id);
  }

  @Get('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  getSettings(@Query('channel') channel = 'WHOLESALE') {
    return this.svc.getSettings(channel);
  }

  @Put('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_settings')
  @ApiBearerAuth()
  updateSettings(
    @Query('channel') channel = 'WHOLESALE',
    @Body() body: Record<string, unknown>,
    @Req() req: AuthedRequest
  ) {
    return this.svc.updateSettings(channel, body as any, this.actor(req));
  }

  @Post('admin/seed-categories')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_categories')
  @ApiBearerAuth()
  seedCategories() {
    return this.svc.ensureSeedCategories();
  }

  @Post('admin/publish-scheduled')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:schedule', 'blog:publish')
  @ApiBearerAuth()
  publishScheduled() {
    return this.svc.publishDueScheduled();
  }

  @Get('admin/roles')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_roles')
  @ApiBearerAuth()
  listBlogRoles() {
    return { roles: BLOG_ROLES };
  }

  @Patch('admin/users/:id/blog-role')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_roles')
  @ApiBearerAuth()
  async setBlogRole(
    @Param('id') id: string,
    @Body() body: { blogRole: string | null },
    @Req() req: AuthedRequest
  ) {
    if (body.blogRole != null && !isBlogRole(body.blogRole)) {
      return { error: 'نقش نامعتبر' };
    }
    await this.userRepo.update(id, { blogRole: body.blogRole });
    const user = await this.userRepo.findOne({ where: { id } });
    await this.svc.writeAudit({
      action: 'blog.role.assign',
      entityType: 'user',
      entityId: id,
      actorId: this.actor(req).id,
      meta: { blogRole: body.blogRole },
    });
    return { id: user?.id, phone: user?.phone, role: user?.role, blogRole: user?.blogRole };
  }

  @Get('admin/authors')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  listAuthors() {
    return this.svc.listAuthors();
  }

  @Post('admin/authors')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:edit_any', 'blog:manage_settings')
  @ApiBearerAuth()
  createAuthor(@Body() body: CreateAuthorDto, @Req() req: AuthedRequest) {
    return this.svc.upsertAuthor(body as any, this.actor(req));
  }

  @Put('admin/authors/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:edit_any', 'blog:manage_settings')
  @ApiBearerAuth()
  updateAuthor(@Param('id') id: string, @Body() body: CreateAuthorDto, @Req() req: AuthedRequest) {
    return this.svc.updateAuthorById(id, body as any, this.actor(req));
  }

  @Delete('admin/authors/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:delete_soft')
  @ApiBearerAuth()
  removeAuthor(@Param('id') id: string) {
    return this.svc.removeAuthor(id);
  }

  @Get('admin/comments/pending')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:approve', 'blog:read')
  @ApiBearerAuth()
  pendingComments(@Query('channel') channel?: string) {
    return this.extras.listPendingComments(channel);
  }

  // ── Phase 2: SEO analyze / revisions / media / links / comments / analytics ──

  @Post('admin/seo/analyze')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read', 'blog:manage_seo')
  @ApiBearerAuth()
  analyzeBody(@Body() body: Record<string, unknown>) {
    return this.extras.analyze(body as any);
  }

  @Post('admin/posts/:id/seo/analyze')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read', 'blog:manage_seo')
  @ApiBearerAuth()
  analyzePost(@Param('id') id: string) {
    return this.extras.analyzePost(id);
  }

  @Get('admin/posts/:id/revisions')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  listRevisions(@Param('id') id: string) {
    return this.extras.listRevisions(id);
  }

  @Post('admin/posts/:id/revisions/:revisionId/restore')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:edit_any')
  @ApiBearerAuth()
  restoreRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @Req() req: AuthedRequest
  ) {
    return this.extras.restoreRevision(id, revisionId, this.actor(req));
  }

  @Post('admin/posts/:id/autosave')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:edit_any', 'blog:edit_own')
  @ApiBearerAuth()
  autosave(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthedRequest
  ) {
    return this.extras.autosave(id, body as any, this.actor(req));
  }

  @Get('admin/media')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  listMedia(
    @Query('channel') channel?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.extras.listMedia({ channel, search, page, limit });
  }

  @Post('admin/media/register')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:create', 'blog:edit_any')
  @ApiBearerAuth()
  registerMedia(@Body() body: Record<string, unknown>, @Req() req: AuthedRequest) {
    return this.extras.registerMedia({
      ...(body as any),
      createdBy: this.actor(req).id,
    });
  }

  @Patch('admin/media/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:edit_any')
  @ApiBearerAuth()
  updateMedia(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.extras.updateMedia(id, body as any);
  }

  @Delete('admin/media/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:delete_soft')
  @ApiBearerAuth()
  removeMedia(@Param('id') id: string) {
    // forceReplace deliberately not exposed: referenced media must return 409.
    return this.extras.removeMedia(id, { forceReplace: false });
  }

  @Post('admin/internal-links/suggest')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  suggestLinks(@Body() body: { channel: string; articleId?: string; q?: string; limit?: number }) {
    return this.extras.suggestInternalLinks(body);
  }

  @Get('admin/posts/:id/related-suggest')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  suggestRelated(@Param('id') id: string) {
    return this.extras.suggestRelatedArticles(id);
  }

  @Get('admin/orphans')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:manage_seo', 'blog:read')
  @ApiBearerAuth()
  orphans(@Query('channel') channel = 'WHOLESALE') {
    return this.extras.findOrphanArticles(channel);
  }

  @Get('admin/products/search')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  searchProducts(
    @Query('q') q = '',
    @Query('channel') channel?: string,
    @Query('limit') limit?: number
  ) {
    return this.extras.searchProducts(q, channel, Number(limit) || 12);
  }

  @Get('admin/posts/:id/comments')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read')
  @ApiBearerAuth()
  adminComments(@Param('id') id: string, @Query('status') status?: string) {
    return this.extras.listComments(id, status);
  }

  @Patch('admin/comments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:approve', 'blog:edit_any')
  @ApiBearerAuth()
  moderateComment(
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED' | 'SPAM' }
  ) {
    return this.extras.moderateComment(id, body.status);
  }

  @Get('admin/posts/:id/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read', 'blog:audit')
  @ApiBearerAuth()
  analytics(@Param('id') id: string) {
    return this.extras.getAnalytics(id);
  }

  @Get('admin/analytics/summary')
  @UseGuards(JwtAuthGuard, RolesGuard, BlogPermissionsGuard)
  @Roles('ADMIN')
  @RequireBlogPermissions('blog:read', 'blog:audit')
  @ApiBearerAuth()
  analyticsSummary(@Query('channel') channel?: string, @Query('limit') limit?: number) {
    return this.extras.analyticsSummary(channel, Number(limit) || 30);
  }

  @Get('authors/:slug')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  getAuthor(@Param('slug') slug: string, @Query('channel') channel?: string) {
    return this.extras.getAuthorBySlug(slug, channel).catch(mapPublicBlogChannelError);
  }

  @Get('article/:id/comments')
  publicComments(@Param('id') id: string) {
    return this.extras.listPublicComments(id);
  }

  @Post('article/:id/comments')
  createComment(
    @Param('id') id: string,
    @Body()
    body: { name: string; email: string; content: string; parentId?: string; website?: string },
    @Req() req: AuthedRequest
  ) {
    const ip = extractClientIp(req);
    const ua = req.headers?.['user-agent'];
    return this.extras.createComment(
      id,
      { ...body, honeypot: body.website },
      { ip, userAgent: Array.isArray(ua) ? ua[0] : ua }
    );
  }

  @Post('article/:id/analytics/:event')
  async track(@Param('id') id: string, @Param('event') event: string, @Req() req: AuthedRequest) {
    // Trust only Fastify req.ip (trustProxy=1). Never raw X-Forwarded-For or x-blog-uv.
    const ip = extractClientIp(req);
    await this.extras.trackEvent(id, event, { ip });
    return { ok: true };
  }

  @Get('article/:id/related-products')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  async relatedProducts(@Param('id') id: string, @Query('channel') channel?: string) {
    try {
      const ch = requirePublicBlogChannel(channel);
      const post = await this.svc.findOneAdmin(id).catch(() => null);
      if (!post || post.status !== 'PUBLISHED') return [];
      return await this.extras.resolveRelatedProducts(post.relatedProductIds || [], ch);
    } catch (err) {
      mapPublicBlogChannelError(err);
    }
  }
}
