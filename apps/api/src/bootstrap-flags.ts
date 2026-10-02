/** Production-like API: APP_ENV empty/unknown is treated as production. */
export function isPublicProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  const appEnv = String(env.APP_ENV || "")
    .trim()
    .toLowerCase();
  if (!appEnv) return true;
  return !new Set(["staging", "local", "disposable", "development", "test"]).has(appEnv);
}

/** Swagger maps auth and payments — never expose on a public origin. */
export function swaggerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (String(env.ENABLE_SWAGGER || "").trim() === "1") return true;
  return !isPublicProduction(env);
}
