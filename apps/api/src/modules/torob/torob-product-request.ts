export const TOROB_PAGE_SORTS = ['date_added_desc', 'date_updated_desc'] as const;
/** @deprecated Use TOROB_PAGE_SORTS — kept for older imports */
export const TOROB_SORTS = TOROB_PAGE_SORTS;
export type TorobPageSort = (typeof TOROB_PAGE_SORTS)[number];
export type TorobSort = TorobPageSort;
export const TOROB_CURSOR_SORT = 'product_id_desc' as const;

export type TorobListQuery = { mode: 'list'; page: number; sort: TorobPageSort };
export type TorobCursorQuery = {
  mode: 'cursor';
  sort: typeof TOROB_CURSOR_SORT;
  cursor?: string;
};
export type TorobLookupQuery =
  | { mode: 'urls'; page_urls: string[] }
  | { mode: 'uniques'; page_uniques: string[] };
export type TorobProductQuery = TorobListQuery | TorobCursorQuery | TorobLookupQuery;

const ALLOWED_KEYS = new Set(['page', 'sort', 'cursor', 'page_urls', 'page_uniques']);

export class TorobBadRequest extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'TorobBadRequest';
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TorobBadRequest(`فیلد ${field} باید عدد صحیح باشد`);
  }
  return value;
}

function asNonEmptyStringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new TorobBadRequest(`فیلد ${field} باید آرایه‌ای از رشته باشد`);
  }
  if (value.length < 1) {
    throw new TorobBadRequest(`فیلد ${field} نباید خالی باشد`);
  }
  if (!value.every((item) => typeof item === 'string' && item.trim())) {
    throw new TorobBadRequest(`هر مقدار ${field} باید رشته غیرخالی باشد`);
  }
  return value.map((item) => item.trim());
}

export function parseTorobProductRequest(body: unknown): TorobProductQuery {
  if (body == null || (typeof body === 'string' && !body.trim())) {
    throw new TorobBadRequest('بدنه درخواست خالی است');
  }
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      throw new TorobBadRequest('بدنه درخواست JSON معتبر نیست');
    }
  }
  if (!isPlainObject(body)) {
    throw new TorobBadRequest('بدنه درخواست باید یک شیء JSON باشد');
  }
  const keys = Object.keys(body);
  if (!keys.length) {
    throw new TorobBadRequest('بدنه درخواست خالی است');
  }
  const unknown = keys.filter((key) => !ALLOWED_KEYS.has(key));
  if (unknown.length) {
    throw new TorobBadRequest(`فیلد ناشناخته: ${unknown.join(', ')}`);
  }

  const hasPage = Object.prototype.hasOwnProperty.call(body, 'page');
  const hasSort = Object.prototype.hasOwnProperty.call(body, 'sort');
  const hasCursor = Object.prototype.hasOwnProperty.call(body, 'cursor');
  const hasUrls = Object.prototype.hasOwnProperty.call(body, 'page_urls');
  const hasUniques = Object.prototype.hasOwnProperty.call(body, 'page_uniques');

  if (hasUrls) {
    if (hasPage || hasSort || hasCursor || hasUniques) {
      throw new TorobBadRequest('فقط یکی از حالت‌های page+sort، cursor، page_urls یا page_uniques مجاز است');
    }
    return { mode: 'urls', page_urls: asNonEmptyStringList(body.page_urls, 'page_urls') };
  }
  if (hasUniques) {
    if (hasPage || hasSort || hasCursor || hasUrls) {
      throw new TorobBadRequest('فقط یکی از حالت‌های page+sort، cursor، page_urls یا page_uniques مجاز است');
    }
    return { mode: 'uniques', page_uniques: asNonEmptyStringList(body.page_uniques, 'page_uniques') };
  }

  if (!hasSort) {
    if (hasPage) throw new TorobBadRequest('پارامتر sort همراه page الزامی است');
    if (hasCursor) throw new TorobBadRequest('پارامتر sort همراه cursor الزامی است');
    throw new TorobBadRequest('بدنه درخواست خالی است');
  }
  if (typeof body.sort !== 'string') {
    throw new TorobBadRequest('sort باید رشته باشد');
  }

  // Cursor mode: {"sort":"product_id_desc"} or {"cursor":"...","sort":"product_id_desc"} — no page/limit/size
  if (body.sort === TOROB_CURSOR_SORT) {
    if (hasPage) {
      throw new TorobBadRequest('در حالت cursor پارامتر page مجاز نیست');
    }
    let cursor: string | undefined;
    if (hasCursor) {
      if (typeof body.cursor !== 'string' || !body.cursor.trim()) {
        throw new TorobBadRequest('cursor باید رشته غیرخالی باشد');
      }
      cursor = body.cursor.trim();
    }
    return { mode: 'cursor', sort: TOROB_CURSOR_SORT, cursor };
  }

  if (hasCursor) {
    throw new TorobBadRequest('cursor فقط با sort=product_id_desc مجاز است');
  }
  if (!hasPage) {
    throw new TorobBadRequest('پارامتر page همراه sort الزامی است');
  }
  const page = asInt(body.page, 'page');
  if (page < 1) {
    throw new TorobBadRequest('page باید بزرگ‌تر یا مساوی ۱ باشد');
  }
  if (!TOROB_PAGE_SORTS.includes(body.sort as TorobPageSort)) {
    throw new TorobBadRequest('sort فقط date_added_desc، date_updated_desc یا product_id_desc است');
  }
  return { mode: 'list', page, sort: body.sort as TorobPageSort };
}

export function torobMaxPages(total: number): number {
  if (!Number.isInteger(total) || total < 0) return 1;
  if (total === 0) return 1;
  return Math.ceil(total / 100);
}
