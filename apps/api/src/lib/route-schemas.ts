import {
  PRODUCT_ACTOR_TYPES,
  PRODUCT_DELIVERY_CHANNELS,
  PRODUCT_DOCUMENT_TYPES,
  PRODUCT_INVOICE_STATUSES,
  PRODUCT_LANGUAGES,
  PRODUCT_MATTER_STATUSES,
  PRODUCT_MATTER_TYPES,
  PRODUCT_MEMBERSHIP_ROLES,
} from "@wakeel/shared";

const strictObject = { additionalProperties: false as const };

export const recordId = {
  type: "string" as const,
  minLength: 1,
  maxLength: 100,
  pattern: "^[a-zA-Z0-9][a-zA-Z0-9_-]*$",
};

export const uuidRecordId = {
  type: "string" as const,
  minLength: 36,
  maxLength: 36,
  pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
};

export const phoneInput = {
  type: "string" as const,
  minLength: 7,
  maxLength: 24,
  pattern: "^[+]?[0-9\\s-]{7,22}$",
};

export const emailInput = {
  type: "string" as const,
  minLength: 3,
  maxLength: 254,
  pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
};

export const otpCode = {
  type: "string" as const,
  minLength: 6,
  maxLength: 6,
  pattern: "^\\d{6}$",
};

export const e164PhoneInput = {
  type: "string" as const,
  minLength: 8,
  maxLength: 16,
  pattern: "^\\+[1-9]\\d{7,14}$",
};

export const nullableEmail = {
  anyOf: [{ type: "null" as const }, emailInput],
};

export const isoDateOrDateTime = {
  type: "string" as const,
  minLength: 10,
  maxLength: 40,
  pattern: "^\\d{4}-\\d{2}-\\d{2}([T ]\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,3})?)?(Z|[+-]\\d{2}:\\d{2})?)?$",
};

export const isoDateOnly = {
  type: "string" as const,
  minLength: 10,
  maxLength: 10,
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
};

export const safeText = (maxLength: number) => ({
  type: "string" as const,
  minLength: 1,
  maxLength,
  pattern: "^(?!.*(?:<script|javascript:|on[a-z]+\\s*=)).*$",
});

export const nullableSafeText = (maxLength: number) => ({
  anyOf: [{ type: "null" as const }, safeText(maxLength)],
});

export const paramId = {
  type: "object" as const,
  required: ["id"] as const,
  properties: { id: recordId },
  ...strictObject,
};

export const paramMatterId = {
  type: "object" as const,
  required: ["id"] as const,
  properties: { id: recordId },
  ...strictObject,
};

export const paramMatterAndPartyId = {
  type: "object" as const,
  required: ["matterId", "partyId"] as const,
  properties: { matterId: recordId, partyId: recordId },
  ...strictObject,
};

export const paramMatterAndClientId = {
  type: "object" as const,
  required: ["matterId", "clientId"] as const,
  properties: { matterId: recordId, clientId: recordId },
  ...strictObject,
};

export const bodyPhoneOtpRequest = {
  type: "object" as const,
  required: ["phone"] as const,
  properties: {
    phone: phoneInput,
    purpose: { type: "string" as const, minLength: 1, maxLength: 100 },
  },
  ...strictObject,
};

export const bodyPhoneOtpVerify = {
  type: "object" as const,
  required: ["phone", "code"] as const,
  properties: {
    phone: phoneInput,
    code: otpCode,
  },
  ...strictObject,
};

export const bodyMagicLinkRequest = {
  type: "object" as const,
  required: ["email"] as const,
  properties: { email: emailInput },
  ...strictObject,
};

export const bodyV1OtpRequest = {
  type: "object" as const,
  required: ["phone", "actorType"] as const,
  properties: {
    phone: phoneInput,
    actorType: { type: "string" as const, enum: [...PRODUCT_ACTOR_TYPES] },
    purpose: { type: "string" as const, minLength: 1, maxLength: 100 },
  },
  ...strictObject,
};

export const bodyV1OtpVerify = {
  type: "object" as const,
  required: ["phone", "code", "actorType"] as const,
  properties: {
    phone: phoneInput,
    code: otpCode,
    actorType: { type: "string" as const, enum: [...PRODUCT_ACTOR_TYPES] },
  },
  ...strictObject,
};

export const bodyPilotInvite = {
  type: "object" as const,
  required: ["phone"] as const,
  properties: {
    phone: phoneInput,
    email: nullableEmail,
  },
  ...strictObject,
};

export const bodyStaffRegister = {
  type: "object" as const,
  required: ["phone", "code", "displayName", "firmName", "primaryCity"] as const,
  properties: {
    phone: phoneInput,
    code: otpCode,
    displayName: safeText(120),
    email: nullableEmail,
    firmName: safeText(160),
    primaryCity: safeText(100),
  },
  ...strictObject,
};

export const bodyRefreshToken = {
  type: "object" as const,
  properties: {
    refreshToken: { type: "string" as const, minLength: 16, maxLength: 512 },
  },
  ...strictObject,
};

export const bodyCreateMatter = {
  type: "object" as const,
  required: ["courtId", "rawCaseNumber", "title", "matterType", "stage", "status"] as const,
  properties: {
    courtId: safeText(100),
    rawCaseNumber: safeText(200),
    normalizedCaseNumber: safeText(200),
    title: safeText(500),
    matterType: { type: "string" as const, enum: [...PRODUCT_MATTER_TYPES] },
    stage: safeText(100),
    status: { type: "string" as const, enum: [...PRODUCT_MATTER_STATUSES] },
    nextHearingAt: { anyOf: [{ type: "null" as const }, isoDateOrDateTime, { type: "string" as const, maxLength: 0 }] },
    leadLawyerId: { anyOf: [{ type: "null" as const }, recordId] },
  },
  ...strictObject,
};

export const bodyMatterCsvPreview = {
  type: "object" as const,
  required: ["csv"] as const,
  properties: {
    csv: { type: "string" as const, minLength: 1, maxLength: 2_000_000 },
  },
  ...strictObject,
};

export const bodyMatterPatch = {
  type: "object" as const,
  minProperties: 1,
  properties: {
    courtId: safeText(100),
    rawCaseNumber: safeText(200),
    normalizedCaseNumber: safeText(200),
    title: safeText(500),
    matterType: { type: "string" as const, enum: [...PRODUCT_MATTER_TYPES] },
    stage: safeText(100),
    status: { type: "string" as const, enum: [...PRODUCT_MATTER_STATUSES] },
    nextHearingAt: { anyOf: [{ type: "null" as const }, isoDateOrDateTime, { type: "string" as const, maxLength: 0 }] },
    leadLawyerId: { anyOf: [{ type: "null" as const }, recordId] },
  },
  ...strictObject,
};

export const bodyCreateParty = {
  type: "object" as const,
  required: ["partyType", "displayName"] as const,
  properties: {
    partyType: { type: "string" as const, enum: ["petitioner", "respondent", "applicant", "other"] },
    displayName: safeText(200),
    contactRef: nullableSafeText(100),
  },
  ...strictObject,
};

export const bodyPartyPatch = {
  type: "object" as const,
  minProperties: 1,
  properties: {
    partyType: { type: "string" as const, enum: ["petitioner", "respondent", "applicant", "other"] },
    displayName: safeText(200),
    contactRef: nullableSafeText(100),
  },
  ...strictObject,
};

export const bodyShareMatterClient = {
  type: "object" as const,
  required: ["clientId"] as const,
  properties: { clientId: recordId },
  ...strictObject,
};

export const bodyCreateClient = {
  type: "object" as const,
  required: ["phone", "displayName"] as const,
  properties: {
    phone: phoneInput,
    displayName: safeText(200),
    language: { type: "string" as const, enum: [...PRODUCT_LANGUAGES] },
  },
  ...strictObject,
};

export const bodyClientPatch = {
  type: "object" as const,
  minProperties: 1,
  properties: {
    displayName: safeText(200),
    language: { type: "string" as const, enum: [...PRODUCT_LANGUAGES] },
    status: { type: "string" as const, enum: ["active", "invited", "archived"] },
  },
  ...strictObject,
};

export const bodyNotificationPreferences = {
  type: "object" as const,
  required: ["emailEnabled", "smsEnabled"] as const,
  properties: {
    emailEnabled: { type: "boolean" as const },
    smsEnabled: { type: "boolean" as const },
    optedOut: { type: "boolean" as const },
  },
  ...strictObject,
};

export const bodyCreateFirm = {
  type: "object" as const,
  required: ["name", "primaryCity"] as const,
  properties: {
    name: safeText(160),
    primaryCity: safeText(100),
  },
  ...strictObject,
};

export const bodyFirmInvitation = {
  type: "object" as const,
  required: ["phone", "role"] as const,
  properties: {
    phone: phoneInput,
    email: nullableEmail,
    role: { type: "string" as const, enum: [...PRODUCT_MEMBERSHIP_ROLES] },
    officeLabel: nullableSafeText(120),
  },
  ...strictObject,
};

export const bodyMembershipPatch = {
  type: "object" as const,
  minProperties: 1,
  properties: {
    role: { type: "string" as const, enum: [...PRODUCT_MEMBERSHIP_ROLES] },
    permissions: {
      type: "array" as const,
      items: { type: "string" as const, minLength: 1, maxLength: 80, pattern: "^[a-z0-9_.*]+$" },
      maxItems: 50,
    },
    officeLabel: nullableSafeText(120),
  },
  ...strictObject,
};

export const bodyMembershipPermissions = {
  type: "object" as const,
  required: ["permissions"] as const,
  properties: {
    permissions: {
      type: "array" as const,
      items: { type: "string" as const, minLength: 1, maxLength: 80, pattern: "^[a-z0-9_.*]+$" },
      minItems: 1,
      maxItems: 50,
    },
  },
  ...strictObject,
};

export const bodyCreateTimeEntry = {
  type: "object" as const,
  required: ["matterId", "startedAt", "minutes", "narrative"] as const,
  properties: {
    matterId: recordId,
    startedAt: isoDateOrDateTime,
    minutes: { type: "integer" as const, minimum: 1, maximum: 24 * 60 },
    narrative: safeText(2_000),
    billable: { type: "boolean" as const },
  },
  ...strictObject,
};

export const bodyCreateInvoice = {
  type: "object" as const,
  required: ["clientAccountId", "status", "total"] as const,
  properties: {
    clientAccountId: recordId,
    matterId: { anyOf: [{ type: "null" as const }, recordId] },
    status: { type: "string" as const, enum: [...PRODUCT_INVOICE_STATUSES] },
    issuedAt: { anyOf: [{ type: "null" as const }, isoDateOrDateTime] },
    dueAt: { anyOf: [{ type: "null" as const }, isoDateOrDateTime] },
    total: { type: "number" as const, minimum: 0, maximum: 1_000_000_000 },
  },
  ...strictObject,
};

export const bodyInvoicePatch = {
  type: "object" as const,
  minProperties: 1,
  properties: {
    status: { type: "string" as const, enum: [...PRODUCT_INVOICE_STATUSES] },
    issuedAt: { anyOf: [{ type: "null" as const }, isoDateOrDateTime] },
    dueAt: { anyOf: [{ type: "null" as const }, isoDateOrDateTime] },
    total: { type: "number" as const, minimum: 0, maximum: 1_000_000_000 },
  },
  ...strictObject,
};

export const bodyCourtSourceSync = {
  type: "object" as const,
  properties: {
    listType: { type: "string" as const, enum: ["regular", "supplementary", "urgent"] },
    listDate: isoDateOnly,
  },
  ...strictObject,
};

export const bodyCourtMatchLink = {
  type: "object" as const,
  required: ["matterId"] as const,
  properties: { matterId: recordId },
  ...strictObject,
};

export const bodyCourtMatchReview = {
  type: "object" as const,
  required: ["state"] as const,
  properties: {
    state: { type: "string" as const, enum: ["approved", "rejected"] },
  },
  ...strictObject,
};

export const bodyPortalLink = {
  type: "object" as const,
  required: ["matterId"] as const,
  properties: {
    matterId: recordId,
    clientId: recordId,
    expiresHours: { type: "integer" as const, minimum: 1, maximum: 24 * 30 },
  },
  ...strictObject,
};

export const bodyPortalOtp = {
  type: "object" as const,
  properties: {
    token: { type: "string" as const, minLength: 16, maxLength: 512 },
  },
  ...strictObject,
};

export const bodyPortalOtpVerify = {
  type: "object" as const,
  required: ["token", "code"] as const,
  properties: {
    token: { type: "string" as const, minLength: 16, maxLength: 512 },
    code: otpCode,
  },
  ...strictObject,
};

export const bodyDocumentLink = {
  type: "object" as const,
  required: ["matterId"] as const,
  properties: { matterId: recordId },
  ...strictObject,
};

export const bodyDocumentPatch = {
  type: "object" as const,
  minProperties: 1,
  properties: {
    title: safeText(500),
    matterId: { anyOf: [{ type: "null" as const }, recordId] },
    folderId: { anyOf: [{ type: "null" as const }, recordId] },
    searchText: { anyOf: [{ type: "null" as const }, { type: "string" as const, maxLength: 20_000 }] },
    portalVisible: { type: "boolean" as const },
  },
  ...strictObject,
};

export const bodyThreadMessage = {
  type: "object" as const,
  required: ["body", "language", "deliveryChannel"] as const,
  properties: {
    body: safeText(5_000),
    language: { type: "string" as const, enum: [...PRODUCT_LANGUAGES] },
    deliveryChannel: { type: "string" as const, enum: [...PRODUCT_DELIVERY_CHANNELS] },
  },
  ...strictObject,
};

export const bodyHearingJson = {
  type: "object" as const,
  properties: {
    listedAt: isoDateOrDateTime,
    outcome: safeText(500),
    notes: safeText(5_000),
    nextDate: { anyOf: [{ type: "null" as const }, isoDateOrDateTime, { type: "string" as const, maxLength: 0 }] },
    courtroom: nullableSafeText(200),
    bench: nullableSafeText(200),
    sourceType: safeText(100),
  },
  ...strictObject,
};
