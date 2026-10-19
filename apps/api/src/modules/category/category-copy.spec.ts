import { doesNotMatch, equal, match, ok } from 'node:assert/strict';
import { isInternalCategoryHref, sanitizeCategoryCopy } from './category-copy';

equal(isInternalCategoryHref('/category/coat-pants-set'), true);
equal(isInternalCategoryHref('/'), true);
equal(isInternalCategoryHref('https://poshaktaranom.com/category/coat-pants-set'), false);
equal(isInternalCategoryHref('//evil.com'), false);
equal(isInternalCategoryHref('javascript:alert(1)'), false);
equal(isInternalCategoryHref('/%2f%2fevil.com'), false);
equal(isInternalCategoryHref('/category/../admin'), false);

const plain = 'ست زنانه عمده\n\nخرید مستقیم از تولیدی.';
equal(sanitizeCategoryCopy(plain), plain);
equal(sanitizeCategoryCopy('   '), null);
equal(sanitizeCategoryCopy('<p></p>'), null);

const linked = sanitizeCategoryCopy(
  '<p>مدل <a href="/category/coat-pants-set" target="_blank" onclick="alert(1)">کت و شلوار</a></p>',
);
ok(linked);
match(linked!, /href="\/category\/coat-pants-set"/);
doesNotMatch(linked!, /onclick|target/);

const external = sanitizeCategoryCopy('<p><a href="https://evil.example">بیرون</a></p>');
ok(external);
doesNotMatch(external!, /href=/);
match(external!, /بیرون/);

const script = sanitizeCategoryCopy('<p>متن</p><script>alert(1)</script><img src=x onerror="alert(1)">');
ok(script);
doesNotMatch(script!, /script|onerror|img/i);
match(script!, /متن/);

console.log('category-copy.spec ok');
