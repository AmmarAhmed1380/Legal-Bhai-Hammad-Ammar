import { createHmac, timingSafeEqual } from "node:crypto";

const HEADER = { alg: "HS256", typ: "JWT" };

function base64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64url")
    .replace(/=/g, "");
}

function decodeBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signature(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signDemoToken(userId: string, secret: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64Url(JSON.stringify(HEADER));
  const encodedPayload = base64Url(
    JSON.stringify({
      sub: userId,
      iat: now,
      exp: now + ttlSeconds,
    }),
  );
  const body = `${encodedHeader}.${encodedPayload}`;
  return `${body}.${signature(secret, body)}`;
}

export function signAppToken(
  payload: {
    actorType: "staff" | "client";
    actorId: string;
    firmId?: string | null;
    sessionId?: string | null;
    portalLinkId?: string | null;
  },
  secret: string,
  ttlSeconds = 60 * 15,
): string {
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64Url(JSON.stringify(HEADER));
  const encodedPayload = base64Url(
    JSON.stringify({
      sub: payload.actorId,
      actorType: payload.actorType,
      firmId: payload.firmId ?? null,
      sid: payload.sessionId ?? null,
      portalLinkId: payload.portalLinkId ?? null,
      iat: now,
      exp: now + ttlSeconds,
    }),
  );
  const body = `${encodedHeader}.${encodedPayload}`;
  return `${body}.${signature(secret, body)}`;
}

export function verifyAppToken(
  token: string,
  secret: string,
): {
  actorType: "staff" | "client";
  actorId: string;
  firmId: string | null;
  sessionId: string | null;
  portalLinkId: string | null;
} | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const expected = signature(secret, `${encodedHeader}.${encodedPayload}`);
  const provided = Buffer.from(encodedSignature);
  const actual = Buffer.from(expected);
  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) {
    return null;
  }

  let payload: {
    sub?: string;
    exp?: number;
    actorType?: "staff" | "client";
    firmId?: string | null;
    sid?: string | null;
    portalLinkId?: string | null;
  };
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload)) as typeof payload;
  } catch {
    return null;
  }

  if (
    !payload.sub ||
    !payload.exp ||
    payload.exp < Math.floor(Date.now() / 1000) ||
    !payload.actorType ||
    !["staff", "client"].includes(payload.actorType)
  ) {
    return null;
  }

  return {
    actorType: payload.actorType,
    actorId: payload.sub,
    firmId: payload.firmId ?? null,
    sessionId: payload.sid ?? null,
    portalLinkId: payload.portalLinkId ?? null,
  };
}

export function verifyDemoToken(token: string, secret: string): { userId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const expected = signature(secret, `${encodedHeader}.${encodedPayload}`);
  const provided = Buffer.from(encodedSignature);
  const actual = Buffer.from(expected);
  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) {
    return null;
  }

  let payload: { sub?: string; exp?: number };
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload)) as typeof payload;
  } catch {
    return null;
  }

  if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { userId: payload.sub };
}

export function readBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}
