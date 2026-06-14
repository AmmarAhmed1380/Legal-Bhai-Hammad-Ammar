import { envFlag, isProduction } from "./config.js";
import { createPostgresProductStore, type PostgresProductStore } from "./postgres-product-store.js";
import { createProductStore, type ProductStore } from "./product-store.js";

export type RuntimeProductStore = ProductStore | PostgresProductStore;

export function shouldUsePostgresProductStore(): boolean {
  return isProduction() || envFlag("USE_POSTGRES_PRODUCT_STORE");
}

export function createRuntimeProductStore(): RuntimeProductStore {
  if (shouldUsePostgresProductStore()) {
    return createPostgresProductStore();
  }
  return createProductStore();
}
