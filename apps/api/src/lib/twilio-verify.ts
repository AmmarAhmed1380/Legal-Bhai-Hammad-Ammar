import { toSmsE164 } from "./validation.js";

let cachedVerifyServiceSid: string | null | undefined;

function twilioAuthHeader(): string {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

export function isTwilioVerifyConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

async function resolveVerifyServiceSid(): Promise<string> {
  if (process.env.TWILIO_VERIFY_SERVICE_SID) {
    return process.env.TWILIO_VERIFY_SERVICE_SID;
  }
  if (cachedVerifyServiceSid) {
    return cachedVerifyServiceSid;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const headers = {
    authorization: twilioAuthHeader(),
    "content-type": "application/x-www-form-urlencoded",
  };

  const listResponse = await fetch(`https://verify.twilio.com/v2/Services?PageSize=20`, { headers });
  if (listResponse.ok) {
    const payload = (await listResponse.json()) as { services?: Array<{ sid: string }> };
    const existing = payload.services?.[0]?.sid;
    if (existing) {
      cachedVerifyServiceSid = existing;
      console.error("[twilio-verify] using existing Verify service", { sid: existing });
      return existing;
    }
  }

  const createResponse = await fetch("https://verify.twilio.com/v2/Services", {
    method: "POST",
    headers,
    body: new URLSearchParams({ FriendlyName: "Legal Bhai OTP" }),
  });
  if (!createResponse.ok) {
    const errorBody = await createResponse.text();
    throw new Error(`Twilio Verify service setup failed with status ${createResponse.status}: ${errorBody}`);
  }
  const created = (await createResponse.json()) as { sid?: string };
  if (!created.sid) {
    throw new Error("Twilio Verify service setup failed: missing service SID");
  }
  cachedVerifyServiceSid = created.sid;
  console.error("[twilio-verify] created Verify service", { sid: created.sid, accountSid });
  return created.sid;
}

export async function sendTwilioVerification(to: string): Promise<{ providerId: string | null }> {
  const destination = toSmsE164(to);
  if (!destination) {
    throw new Error(`Invalid SMS destination phone: ${to}`);
  }
  const serviceSid = await resolveVerifyServiceSid();
  console.error("[twilio-verify] sending verification", { to: destination, serviceSid });
  const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, {
    method: "POST",
    headers: {
      authorization: twilioAuthHeader(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: destination, Channel: "sms" }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[twilio-verify] send failed", { status: response.status, body: errorBody, to: destination });
    throw new Error(`Twilio Verify failed with status ${response.status}: ${errorBody}`);
  }
  const payload = (await response.json()) as { sid?: string };
  return { providerId: payload.sid ?? null };
}

export async function checkTwilioVerification(to: string, code: string): Promise<boolean> {
  const destination = toSmsE164(to);
  if (!destination) {
    return false;
  }
  const serviceSid = await resolveVerifyServiceSid();
  const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`, {
    method: "POST",
    headers: {
      authorization: twilioAuthHeader(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: destination, Code: code.trim() }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[twilio-verify] check failed", { status: response.status, body: errorBody, to: destination });
    return false;
  }
  const payload = (await response.json()) as { status?: string };
  return payload.status === "approved";
}
