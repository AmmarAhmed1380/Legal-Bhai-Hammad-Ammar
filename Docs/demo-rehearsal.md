# Wakeel Demo Rehearsal

## Fixed setup

- Account: `Zo Ahmed` (`03001234567`)
- Demo code: `111111`
- Hero case: `W.P. 2076/2019` (`Redtone Telecommunications Pak Pvt Ltd v CIR etc`)
- Hearing image: `/Users/zohaib/Desktop/LEGALBAHI/docs/demo-assets/hearing-order-sample.png`
- SMS preview to show: `post_hearing`
- Client share link: generate from the hero case immediately after the hearing upload
- Reset point: click `Reset demo` on the web dashboard before runs 2 and 3

## Expected sync callout

- From the web dashboard, click `Sync IHC`
- Mention: `IHC sync checked 220 live rows and matched the seeded W.P. 2076/2019 demo case`
- On the current hardening dataset, this should read as `matched 1 seeded cases`

## Run script

1. Web login with the admin account and open the dashboard.
2. Click `Sync IHC` and call out the matched live IHC case.
3. Open `W.P. 2076/2019` from the case roster.
4. Create the client share link and leave that tab ready.
5. In mobile, log in as the same admin account.
6. On Home, point to the `IHC last synced at ...` line above the hearings list.
7. Open `W.P. 2076/2019`, upload `docs/demo-assets/hearing-order-sample.png`, and save the hearing.
8. Show the `post-hearing` SMS preview.
9. Return to the web client-share tab and show the read-only portal.

## Reset cadence

- Before run 2: click `Reset demo`, confirm the modal, wait for the reset success message, then repeat the script.
- Before run 3: repeat the same reset flow, then repeat the script unchanged.

## Notes

- If `GOOGLE_CLOUD_VISION_API_KEY` is not set, call out that the OCR hook is wired and returns `pending_config` in demo mode.
- Do not switch hero cases between runs. The point of the rehearsal is that the same path survives three clean resets.
