import type { OmnichannelListPage } from '../dto/omnichannel-list-page.dto';

export const OMNICHANNEL_LIST_DEFAULT_LIMIT = 20;
export const OMNICHANNEL_LIST_MAX_LIMIT = 50;

export function normalizeListPageQuery(input: {
  page?: unknown;
  limit?: unknown;
}): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  let limit = Math.floor(Number(input.limit) || OMNICHANNEL_LIST_DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit < 1) limit = OMNICHANNEL_LIST_DEFAULT_LIMIT;
  if (limit > OMNICHANNEL_LIST_MAX_LIMIT) limit = OMNICHANNEL_LIST_MAX_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

export function paginateItems<T>(
  items: T[],
  pageInput?: unknown,
  limitInput?: unknown,
): OmnichannelListPage<T> {
  const { page, limit, skip } = normalizeListPageQuery({ page: pageInput, limit: limitInput });
  const total = items.length;
  return {
    items: items.slice(skip, skip + limit),
    total,
    page,
    limit,
  };
}
