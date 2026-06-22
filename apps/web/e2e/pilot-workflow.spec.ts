import { expect, test, type Locator, type Page } from "@playwright/test";

const API_URL = "http://127.0.0.1:3401";
const MOCK_OTP_CODE = "246810";

function field(container: Locator, label: string): Locator {
  return container.locator(".field").filter({ hasText: label }).locator("input, textarea, select").first();
}

async function fillOtpCode(scope: Page | Locator) {
  const otpInput = scope.locator(".otp-digit-input").first();
  await expect(otpInput).toBeVisible();
  await otpInput.click();
  await otpInput.pressSequentially(MOCK_OTP_CODE);
}

async function verifyLawyerWorkspaceOtp(page: Page) {
  const authCard = page.locator(".auth-card");
  await expect(authCard.getByText("OTP Verification Code:")).toBeVisible();
  await fillOtpCode(authCard);
  await authCard.getByRole("button", { name: "Verify & Create Workspace" }).click();
}

async function verifyPortalOtp(page: Page) {
  await expect(page.getByText(/^OTP for /)).toBeVisible();
  await fillOtpCode(page);
  await page.getByRole("button", { name: "Verify and open shared matter" }).click();
}

test("invited lawyer completes the web pilot workflow through client portal OTP", async ({ context, page, request }) => {
  test.setTimeout(90_000);
  const suffix = String(Date.now()).slice(-7);
  const lawyerPhone = `0300${suffix}`;
  const clientPhone = `0311${suffix}`;
  const firmName = `E2E Chambers ${suffix}`;
  const caseNumber = `W.P. ${suffix}/2026`;
  const matterTitle = `E2E controlled pilot matter ${suffix}`;
  const clientName = `E2E Client ${suffix}`;
  const hearingNotes = `Client update recorded for ${suffix}`;
  const clientUpdate = `Your hearing update is ready for ${suffix}.`;

  const invite = await request.post(`${API_URL}/v1/pilot/invites`, {
    headers: { "x-pilot-admin-secret": "legalbahi-e2e-admin-secret" },
    data: { phone: lawyerPhone, email: `lawyer-${suffix}@example.test` },
  });
  expect(invite.ok(), await invite.text()).toBeTruthy();

  await page.goto("/overview");
  await page.getByRole("button", { name: "Create Workspace" }).click();
  const authCard = page.locator(".auth-card");
  await field(authCard, "Phone Number").fill(lawyerPhone);
  await field(authCard, "Full Name").fill(`E2E Lawyer ${suffix}`);
  await field(authCard, "Email Address").fill(`lawyer-${suffix}@example.test`);
  await field(authCard, "Firm / Chamber Name").fill(firmName);
  await field(authCard, "Primary City").fill("Islamabad");
  await page.getByRole("button", { name: "Request OTP" }).click();
  await verifyLawyerWorkspaceOtp(page);
  await expect(page.getByRole("heading", { name: firmName })).toBeVisible();

  await page.goto("/matters");
  const addMatter = page.getByRole("heading", { name: "Add matter" }).locator("..");
  await field(addMatter, "Court").selectOption("ihc");
  await field(addMatter, "Case number").fill(caseNumber);
  await field(addMatter, "Title").fill(matterTitle);
  await field(addMatter, "Next Date").fill("2026-07-01");
  await addMatter.getByRole("button", { name: "Create matter" }).click();
  await expect(page.getByText(`Created ${caseNumber}.`)).toBeVisible();

  await page.goto("/clients");
  const addClient = page.getByRole("heading", { name: "Add client" }).locator("..");
  await field(addClient, "Name").fill(clientName);
  await field(addClient, "Phone").fill(clientPhone);
  await addClient.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByText("Client created.")).toBeVisible();

  await page.goto("/matters");
  await page.getByRole("button", { name: new RegExp(caseNumber) }).click();
  const clientAccess = page.getByRole("heading", { name: "Client access" }).locator("..");
  await field(clientAccess, "Client").selectOption({ label: clientName });
  await clientAccess.getByRole("button", { name: "Link client to matter" }).click();
  await expect(page.getByText("Client linked to matter.")).toBeVisible();

  const hearingPanel = page.getByRole("heading", { name: "Capture hearing" }).locator("..");
  await field(hearingPanel, "Outcome").fill("Adjourned");
  await field(hearingPanel, "Hearing notes").fill(hearingNotes);
  await field(hearingPanel, "Next date").fill("2026-07-15");
  await hearingPanel.getByRole("button", { name: "Save hearing update" }).click();
  await expect(page.getByText(`Saved hearing update for ${caseNumber}.`)).toBeVisible();

  const threadPanel = page.getByRole("heading", { name: "Chat" }).locator("..");
  await threadPanel.getByPlaceholder("Write a reply...").fill(clientUpdate);
  await threadPanel.locator("input + button").click();
  await expect(threadPanel.getByText(clientUpdate)).toBeVisible();

  await clientAccess.getByRole("button", { name: "Create portal link" }).click();
  const portalUrl = await clientAccess.locator("a").getAttribute("href");
  expect(portalUrl).toBeTruthy();

  const clientPage = await context.newPage();
  await clientPage.goto(portalUrl!);
  await expect(clientPage.getByText(matterTitle)).not.toBeVisible();
  await clientPage.getByRole("button", { name: "Request portal OTP" }).click();
  await verifyPortalOtp(clientPage);

  await expect(clientPage.getByText(matterTitle).first()).toBeVisible();
  await expect(clientPage.getByText(hearingNotes)).toBeVisible();
});

