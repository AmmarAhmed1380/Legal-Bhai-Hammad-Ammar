import { isProduction } from "./config.js";
import { toPakistanE164 } from "./validation.js";

export interface SmsProvider {
  send(to: string, body: string): Promise<{ providerId: string | null }>;
}

export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<{ providerId: string | null }>;
}

class DevelopmentSmsProvider implements SmsProvider {
  async send(): Promise<{ providerId: string | null }> {
    return { providerId: null };
  }
}

class TwilioSmsProvider implements SmsProvider {
  async send(to: string, body: string): Promise<{ providerId: string | null }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_SMS_FROM!;
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: toPakistanE164(to) ?? to, From: from, Body: body }),
    });
    if (!response.ok) {
      throw new Error(`Twilio SMS failed with status ${response.status}`);
    }
    const payload = (await response.json()) as { sid?: string };
    return { providerId: payload.sid ?? null };
  }
}

class DevelopmentEmailProvider implements EmailProvider {
  async send(): Promise<{ providerId: string | null }> {
    return { providerId: null };
  }
}

class ResendEmailProvider implements EmailProvider {
  async send(to: string, subject: string, html: string): Promise<{ providerId: string | null }> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [to], subject, html }),
    });
    if (!response.ok) {
      throw new Error(`Resend email failed with status ${response.status}`);
    }
    const payload = (await response.json()) as { id?: string };
    return { providerId: payload.id ?? null };
  }
}

export function createSmsProvider(): SmsProvider {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM) {
    return new TwilioSmsProvider();
  }
  if (isProduction()) {
    throw new Error("Twilio SMS credentials must be configured in production");
  }
  return new DevelopmentSmsProvider();
}

export function createEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    return new ResendEmailProvider();
  }
  if (isProduction()) {
    throw new Error("Resend credentials must be configured in production");
  }
  return new DevelopmentEmailProvider();
}
