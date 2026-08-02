/** Blog RBAC — maps to weblog.md BlogRole */

export const BLOG_ROLES = [
  'SUPER_ADMIN',
  'SEO_MANAGER',
  'CONTENT_MANAGER',
  'EDITOR',
  'AUTHOR',
  'REVIEWER',
  'VIEWER',
] as const;

export type BlogRole = (typeof BLOG_ROLES)[number];

export type BlogPermission =
  | 'blog:read'
  | 'blog:create'
  | 'blog:edit_own'
  | 'blog:edit_any'
  | 'blog:delete_soft'
  | 'blog:delete_hard'
  | 'blog:publish'
  | 'blog:schedule'
  | 'blog:submit_review'
  | 'blog:approve'
  | 'blog:reject'
  | 'blog:manage_seo'
  | 'blog:manage_redirects'
  | 'blog:manage_categories'
  | 'blog:manage_tags'
  | 'blog:manage_settings'
  | 'blog:manage_roles'
  | 'blog:import'
  | 'blog:export'
  | 'blog:audit';

const ALL: BlogPermission[] = [
  'blog:read',
  'blog:create',
  'blog:edit_own',
  'blog:edit_any',
  'blog:delete_soft',
  'blog:delete_hard',
  'blog:publish',
  'blog:schedule',
  'blog:submit_review',
  'blog:approve',
  'blog:reject',
  'blog:manage_seo',
  'blog:manage_redirects',
  'blog:manage_categories',
  'blog:manage_tags',
  'blog:manage_settings',
  'blog:manage_roles',
  'blog:import',
  'blog:export',
  'blog:audit',
];

const ROLE_PERMISSIONS: Record<BlogRole, BlogPermission[]> = {
  SUPER_ADMIN: ALL,
  SEO_MANAGER: [
    'blog:read',
    'blog:edit_any',
    'blog:publish',
    'blog:approve',
    'blog:reject',
    'blog:manage_seo',
    'blog:manage_redirects',
    'blog:export',
    'blog:audit',
  ],
  CONTENT_MANAGER: [
    'blog:read',
    'blog:create',
    'blog:edit_own',
    'blog:edit_any',
    'blog:delete_soft',
    'blog:publish',
    'blog:schedule',
    'blog:submit_review',
    'blog:manage_categories',
    'blog:manage_tags',
    'blog:import',
    'blog:export',
  ],
  EDITOR: ['blog:read', 'blog:edit_any', 'blog:submit_review', 'blog:export'],
  AUTHOR: ['blog:read', 'blog:create', 'blog:edit_own', 'blog:submit_review'],
  REVIEWER: ['blog:read', 'blog:approve', 'blog:reject'],
  VIEWER: ['blog:read'],
};

export function isBlogRole(value: unknown): value is BlogRole {
  return typeof value === 'string' && (BLOG_ROLES as readonly string[]).includes(value);
}

/** ADMIN without blogRole ⇒ SUPER_ADMIN for compatibility */
export function resolveBlogRole(user: { role?: string; blogRole?: string | null }): BlogRole | null {
  if (user?.role === 'ADMIN') {
    if (isBlogRole(user.blogRole)) return user.blogRole;
    return 'SUPER_ADMIN';
  }
  if (isBlogRole(user?.blogRole)) return user.blogRole!;
  return null;
}

export function hasBlogPermission(
  user: { role?: string; blogRole?: string | null },
  permission: BlogPermission,
): boolean {
  const role = resolveBlogRole(user);
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function blogPermissionsFor(role: BlogRole): BlogPermission[] {
  return ROLE_PERMISSIONS[role];
}
