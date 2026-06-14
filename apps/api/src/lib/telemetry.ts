import * as Sentry from "@sentry/node";

export function initializeErrorReporting(): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    sendDefaultPii: false,
  });
}

export function captureError(error: unknown): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
}
