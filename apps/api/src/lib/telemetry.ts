import * as Sentry from "@sentry/node";

let initialized = false;

export function initializeErrorReporting(): void {
  if (initialized || !process.env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  });

  initialized = true;
}

export function registerProcessErrorHandlers(): void {
  process.on("unhandledRejection", (reason) => {
    captureError(reason, { handler: "unhandledRejection" });
    console.error("[process] unhandledRejection", reason);
  });

  process.on("uncaughtException", (error) => {
    captureError(error, { handler: "uncaughtException" });
    console.error("[process] uncaughtException", error);
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("error_context", context);
      for (const [key, value] of Object.entries(context)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          scope.setTag(key, String(value));
        }
      }
    }
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}

export async function flushErrorReporting(timeoutMs = 2000): Promise<void> {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  await Sentry.flush(timeoutMs);
}
