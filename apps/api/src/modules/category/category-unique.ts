import { BadRequestException } from '@nestjs/common';

function uniqueDetail(err: unknown): { code?: string; detail: string } {
  const e = (err ?? {}) as {
    code?: string;
    detail?: string;
    driverError?: { code?: string; detail?: string };
  };
  return {
    code: e.code ?? e.driverError?.code,
    detail: String(e.detail ?? e.driverError?.detail ?? e),
  };
}

export function categoryUniqueMessage(err: unknown): string | null {
  const { code, detail } = uniqueDetail(err);
  const blob = `${detail} ${String((err as { constraint?: string })?.constraint ?? '')}`;
  if (code !== '23505' && !/unique/i.test(blob)) return null;
  if (/\(name\)/i.test(blob) || /categories_name/i.test(blob)) {
    return 'این نام فارسی قبلاً برای یک دسته فعال استفاده شده است';
  }
  if (/\(slug\)/i.test(blob) || /categories_slug/i.test(blob)) {
    return 'این اسلاگ قبلاً برای یک دسته فعال استفاده شده است';
  }
  if (code === '23505') {
    return 'مقدار تکراری برای دسته‌بندی';
  }
  return null;
}

export function throwCategoryUniqueOrRethrow(err: unknown): never {
  const message = categoryUniqueMessage(err);
  if (message) throw new BadRequestException(message);
  throw err;
}
