import { SetMetadata } from '@nestjs/common';
import type { BlogPermission } from '../../blog/blog-roles';

export const BLOG_PERMISSIONS_KEY = 'blog_permissions';

/** Require ANY of the listed blog permissions (OR). */
export const RequireBlogPermissions = (...permissions: BlogPermission[]) =>
  SetMetadata(BLOG_PERMISSIONS_KEY, permissions);
