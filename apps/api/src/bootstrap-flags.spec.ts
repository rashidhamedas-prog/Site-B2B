/**
 * npx ts-node --transpile-only src/bootstrap-flags.spec.ts
 */
import * as assert from "assert";
import { isPublicProduction, swaggerEnabled } from "./bootstrap-flags";

assert.strictEqual(isPublicProduction({}), true);
assert.strictEqual(isPublicProduction({ APP_ENV: "production" }), true);
assert.strictEqual(isPublicProduction({ APP_ENV: "local" }), false);
assert.strictEqual(swaggerEnabled({ APP_ENV: "production" }), false);
assert.strictEqual(swaggerEnabled({ APP_ENV: "local" }), true);
assert.strictEqual(swaggerEnabled({ APP_ENV: "production", ENABLE_SWAGGER: "1" }), true);
console.log("bootstrap-flags.spec ok");
