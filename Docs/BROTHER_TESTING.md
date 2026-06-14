# Brother Testing Guide

Use this mode only with fake test information. It is for checking the product before real hosting.

## Same Wi-Fi: easiest method

Your Mac and your brother's phone or laptop must be connected to the same Wi-Fi.

From the LegalBahi folder, run:

```bash
npm run brother:test
```

The terminal prints the exact website address. It normally looks like:

```text
http://10.0.0.39:3000/overview
```

Send that address to your brother. Keep the terminal open while he tests.

Test lawyer login:

```text
Phone: 03001234567
OTP:   246810
```

Test client login:

```text
Phone: 03005550001
OTP:   246810
```

The OTP field fills automatically in this testing mode. These OTPs and accounts will not exist in production.

## Test fresh lawyer signup

Stop the server with `Ctrl+C`, then run this using your brother's phone number:

```bash
BROTHER_PHONE=03XXXXXXXXX npm run brother:test
```

He should:

1. Open the printed website address.
2. Select **Invited lawyer? Create workspace**.
3. Enter the invited phone number, his test name, test email, practice name, and city.
4. Request OTP and use `246810`.
5. Confirm that a new empty private workspace is created.

Do not use his real email unless needed. This test mode does not send real SMS or email.

## Android through Expo Go

Install **Expo Go** on his Android phone. Keep the phone and Mac on the same Wi-Fi, then run:

```bash
npm run brother:test:mobile
```

Scan the Expo QR code using Expo Go. Use the lawyer test account or the invited phone number.

This checks the app screens and camera workflow. It is not the final installable LegalBahi APK.

## Feature checklist

Ask your brother to record **Pass**, **Fail**, or **Confusing** for each item:

1. Login as the existing lawyer.
2. View overview totals, matters, calendar, and alerts.
3. Create a new matter.
4. Edit the matter and add a next hearing date.
5. Add, rename, and remove a party.
6. Create a client and link the client to the matter.
7. Save client SMS consent/preferences.
8. Add a hearing result, notes, and next date.
9. Upload a fake hearing order or document.
10. Mark a document visible to the client.
11. Search for the document in Vault.
12. Import cases using the CSV template and review rejected rows.
13. Run the IHC sync and inspect matched/unmatched review.
14. Check calendar conflict warnings.
15. Send a client-thread update.
16. Create a protected portal link.
17. Open the portal link in a private/incognito browser.
18. Confirm no matter appears before OTP.
19. Enter OTP `246810` and confirm exactly one matter appears.
20. Confirm the client can see only shared documents.
21. Sign out and confirm the session ends.
22. Test the Android matter, hearing note, camera upload, alerts, and client update screens.

He can record the results in [BROTHER_FEEDBACK.md](BROTHER_FEEDBACK.md).

## Features that are simulated in this mode

- OTP uses fixed test code `246810`; no real SMS is sent.
- Email and SMS delivery providers do not send messages.
- Files are stored privately on this Mac, not Cloudflare R2.
- The database is a local test SQLite database, not production PostgreSQL.
- The website works only while your Mac and the command are running.

These production features are already implemented but must be tested after real hosting and provider setup.

## Reset all brother-test data

Stop the running test command, then run:

```bash
npm run brother:test:reset
```

The next `npm run brother:test` starts with the original seeded test workspace.

## Testing from another city or network

The same-Wi-Fi address will not work outside your home or office network.

For remote testing, use the planned HTTPS deployment or a temporary authenticated HTTPS tunnel. Do not expose port `3001` directly to the internet and do not use real client data until the production launch checks pass.

Do not expose `npm run brother:test` directly to the public internet. It deliberately uses fixed OTP `246810` for easy local testing.

## If the address does not open

1. Confirm both devices are on the same Wi-Fi, not mobile data or a guest network.
2. Keep the terminal command running.
3. Allow Node.js through the macOS firewall if macOS asks.
4. Restart `npm run brother:test`; the Mac's Wi-Fi address can change.
5. Confirm the terminal says both the API and web app are ready.
