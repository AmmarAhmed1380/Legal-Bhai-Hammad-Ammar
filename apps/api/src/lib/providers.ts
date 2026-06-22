import { isProduction } from "./config.js";
import { toSmsE164 } from "./validation.js";

export interface SmsProvider {
  send(to: string, body: string): Promise<{ providerId: string | null }>;
}

export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<{ providerId: string | null }>;
}

export interface WhatsAppProvider {
  send(to: string, body: string): Promise<{ providerId: string | null }>;
}

export const WHATSAPP_PRIORITY_TEMPLATE_KEYS = new Set([
  "post_hearing_update",
  "client_hearing_reminder",
  "portal_access_token",
]);

class DevelopmentSmsProvider implements SmsProvider {
  async send(): Promise<{ providerId: string | null }> {
    return { providerId: null };
  }
}

class TwilioSmsProvider implements SmsProvider {
  async send(to: string, body: string): Promise<{ providerId: string | null }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const from = toSmsE164(process.env.TWILIO_SMS_FROM!) ?? process.env.TWILIO_SMS_FROM!.trim();
    const destination = toSmsE164(to);
    if (!destination) {
      throw new Error(`Invalid SMS destination phone: ${to}`);
    }
    if (!/^\+[1-9]\d{7,14}$/.test(from)) {
      throw new Error(`Invalid Twilio SMS From number (expected E.164): ${process.env.TWILIO_SMS_FROM}`);
    }
    console.error("[twilio] sending SMS", { to: destination, from });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: destination, From: from, Body: body }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[twilio] SMS failed", { status: response.status, body: errorBody, to: destination, from });
      throw new Error(`Twilio SMS failed with status ${response.status}: ${errorBody}`);
    }
    const payload = (await response.json()) as { sid?: string };
    return { providerId: payload.sid ?? null };
  }
}

class DevelopmentWhatsAppProvider implements WhatsAppProvider {
  async send(): Promise<{ providerId: string | null }> {
    return { providerId: null };
  }
}

class TwilioWhatsAppProvider implements WhatsAppProvider {
  async send(to: string, body: string): Promise<{ providerId: string | null }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_WHATSAPP_FROM ?? process.env.TWILIO_SMS_FROM!;
    const destination = toSmsE164(to);
    if (!destination) {
      throw new Error(`Invalid WhatsApp destination phone: ${to}`);
    }
    const fromAddress = from.startsWith("whatsapp:") ? from : `whatsapp:${toSmsE164(from) ?? from}`;
    const toAddress = destination.startsWith("whatsapp:") ? destination : `whatsapp:${destination}`;
    console.error("[twilio-whatsapp] sending message", { to: toAddress, from: fromAddress });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: toAddress, From: fromAddress, Body: body }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[twilio-whatsapp] send failed", { status: response.status, body: errorBody, to: toAddress });
      throw new Error(`Twilio WhatsApp failed with status ${response.status}: ${errorBody}`);
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
  if (process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim() && process.env.TWILIO_SMS_FROM?.trim()) {
    return new TwilioSmsProvider();
  }
  return new DevelopmentSmsProvider();
}

export function createWhatsAppProvider(): WhatsAppProvider {
  if (process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim() && (process.env.TWILIO_WHATSAPP_FROM?.trim() || process.env.TWILIO_SMS_FROM?.trim())) {
    return new TwilioWhatsAppProvider();
  }
  return new DevelopmentWhatsAppProvider();
}

export async function dispatchClientSmsWithWhatsAppFailover(input: {
  templateKey: string;
  phone: string;
  body: string;
  whatsAppProvider: WhatsAppProvider;
  smsProvider: SmsProvider;
}): Promise<{ providerId: string | null; channel: "whatsapp" | "sms" }> {
  if (WHATSAPP_PRIORITY_TEMPLATE_KEYS.has(input.templateKey)) {
    try {
      const delivery = await input.whatsAppProvider.send(input.phone, input.body);
      return { providerId: delivery.providerId, channel: "whatsapp" };
    } catch (error) {
      console.error("[notify] WhatsApp dispatch failed, falling back to SMS", {
        templateKey: input.templateKey,
        phone: input.phone,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  const delivery = await input.smsProvider.send(input.phone, input.body);
  return { providerId: delivery.providerId, channel: "sms" };
}

export function createEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()) {
    return new ResendEmailProvider();
  }
  return new DevelopmentEmailProvider();
}
