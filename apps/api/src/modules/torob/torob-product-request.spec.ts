import { parseTorobProductRequest, torobMaxPages, TorobBadRequest } from './torob-product-request';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function expectError(body: unknown, includes: string) {
  try {
    parseTorobProductRequest(body);
    throw new Error(`expected 400 for ${JSON.stringify(body)}`);
  } catch (err) {
    if (!(err instanceof TorobBadRequest)) throw err;
    assert(err.status === 400, 'status 400');
    assert(new RegExp(includes).test(err.message), `message ${includes}`);
  }
}

expectError(null, 'خالی');
expectError({}, 'خالی');
expectError({ page: 1, sort: 'date_added_desc', page_urls: ['https://x'] }, 'فقط یکی');
expectError({ foo: 1 }, 'ناشناخته');
expectError({ page: 1 }, 'sort');
expectError({ page: 0, sort: 'date_added_desc' }, '۱');
expectError({ page: -2, sort: 'date_added_desc' }, '۱');
expectError({ page: 1, sort: 'price' }, 'sort');
expectError({ page_urls: [] }, 'خالی');
expectError({ page_uniques: [] }, 'خالی');
expectError({ page: 1.5, sort: 'date_added_desc' }, 'صحیح');

const list = parseTorobProductRequest({ page: 2, sort: 'date_updated_desc' });
assert(list.mode === 'list' && list.page === 2 && list.sort === 'date_updated_desc', 'list parse');

assert(torobMaxPages(0) === 1, 'max 0');
assert(torobMaxPages(1) === 1, 'max 1');
assert(torobMaxPages(99) === 1, 'max 99');
assert(torobMaxPages(100) === 1, 'max 100');
assert(torobMaxPages(101) === 2, 'max 101');
assert(torobMaxPages(201) === 3, 'max 201');

console.log('torob-product-request.spec ok');
