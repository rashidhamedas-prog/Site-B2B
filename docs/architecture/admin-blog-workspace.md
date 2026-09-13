# Admin blog workspace

Confirmed 2026-09-13. Completes `/admin/blog` without a second CMS.

## Facts

- One Nest `BlogModule`, two channels (`WHOLESALE` / `RETAIL`), unique `(channel, slug)`.
- Public surfaces already send channel. Admin previously kept a separate `useState` channel in every hub tab, so taxonomy/settings/analytics drifted from the posts table.
- Authors are a shared aggregate; public author pages still require `channel`.
- `TASK-20260826-001` still owns `blog.controller.ts` / `blog.service.ts` / `blog-extras.service.ts`. This workspace talks to those APIs only.

## Research used (not installed)

| Source | Takeaway applied here |
| --- | --- |
| [Ghost Admin + Content API](https://docs.ghost.org/architecture) | Split admin write from public read; posts carry tags/authors; drafts + schedule |
| Ghost is not multi-site | One instance ≠ two publications. Taranom already models publications as `channel` |
| [Payload drafts/locale](https://payloadcms.com/docs/versions/drafts) | One locale/channel switcher in the shell; URL is source of truth |
| [Strapi](https://github.com/strapi/strapi) | Draft/publish + content-type fields mapped 1:1 to admin forms |
| WordPress editorial + Yoast | SEO/social/schema stay on the post, not a page builder |

## Decisions

1. Workspace query: `?channel=RETAIL&tab=taxonomy`. Defaults: wholesale + posts.
2. One channel switcher on the hub. Child panels read `useAdminBlogWorkspace()`.
3. `syncEpoch` after mutations so media/orphans/taxonomy/settings refetch together.
4. Settings PUT strips `id` / `channel` / timestamps so a wholesale row cannot overwrite retail.
5. Post save now sends `primaryCta` and `authorId` that the API already accepts.
6. Preview uses `lightSanitizeHtml` (same as storefront). No new sanitizer dependency.
7. No page builder, no Ghost/Strapi install, no extra microservice.

## Non-goals

- Live GSC click/impression API
- User-picker UI for `PATCH /blog/admin/users/:id/blog-role` (roles tab is the matrix only)
- Changing public blog URLs
- Production schema migration

## Ownership

| Surface | Channel scoped | Owner |
| --- | --- | --- |
| Posts, categories, tags, media, orphans, redirects, settings, comments, analytics | yes | this workspace |
| Authors | shared list; public filter by channel | this workspace UI + existing API |
| Public `/blog/*` | yes | storefront + 026 public channel guards |
