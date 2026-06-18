export const PRODUCT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface ProductAuthState {
  token: string;
  refreshToken: string | null;
}

const refreshRequests = new Map<string, Promise<ProductAuthState>>();

export class ProductRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function productJsonRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${PRODUCT_API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    let errorMessage = body;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error) errorMessage = parsed.error;
    } catch {}
    throw new ProductRequestError(response.status, errorMessage || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function readStoredProductAuth(storageKey: string): ProductAuthState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ProductAuthState;
    if (typeof parsed.token === "string") {
      return {
        token: parsed.token,
        refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      };
    }
  } catch {
    return { token: raw, refreshToken: null };
  }

  return null;
}

export function writeStoredProductAuth(storageKey: string, auth: ProductAuthState | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!auth) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(auth));
}

export function refreshProductAuth(refreshToken: string): Promise<ProductAuthState> {
  const existing = refreshRequests.get(refreshToken);
  if (existing) {
    return existing;
  }

  const request = productJsonRequest<{ token: string; refreshToken: string | null }>("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  }).then((response) => ({
    token: response.token,
    refreshToken: response.refreshToken ?? refreshToken,
  })).catch((error) => {
    refreshRequests.delete(refreshToken);
    throw error;
  });
  refreshRequests.set(refreshToken, request);
  globalThis.setTimeout(() => refreshRequests.delete(refreshToken), 30_000);
  return request;
}

export function productDocumentContentUrl(documentId: string): string {
  return `${PRODUCT_API_BASE_URL}/v1/documents/${documentId}/content`;
}

export function productDocumentDownloadUrl(documentId: string, portalToken?: string | null): string {
  const url = new URL(`${PRODUCT_API_BASE_URL}/v1/documents/${documentId}/download`);
  if (portalToken) {
    url.searchParams.set("token", portalToken);
  }
  return url.toString();
}
