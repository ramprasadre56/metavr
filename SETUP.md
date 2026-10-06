# Meta VR Start Developer Competition 2026 — Dev Setup

Account: ramprasadre56@gmail.com · Deadline: **Nov 18, 2026, 12:00pm PST**
Platform: **WebXR (Immersive Web SDK)** — VR starter, TypeScript, locomotion + grabbing + physics.

## Done
- Node 22.23.1, npm 10.9.8, Git 2.44 verified (git identity = ramprasadre56@gmail.com)
- Project scaffolded here with `npm create @iwsdk@latest` (IWSDK 1.0.1), deps installed
- `npm run typecheck` and `npm run build` pass; initial git commit made
- AI-agent adapters configured by IWSDK (Claude `.mcp.json`/CLAUDE.md, Cursor, Copilot, Codex)

## Daily commands
| Command | What it does |
|---|---|
| `npm run dev` | Dev server + managed browser with Quest 3 emulator (https://localhost:8081) |
| `npm run dev:status` | Show runtime URLs (incl. LAN URL for the headset) |
| `npm run dev:down` | Stop the dev session |
| `npm run build` | Production build to `dist/` |

## Your manual steps (need your login / headset)
1. **Meta developer account** — sign in at https://developers.meta.com/horizon with ramprasadre56@gmail.com and create/verify an organization (needed for Developer Mode).
2. **Meta Quest Developer Hub (Windows)** — download from
   https://developers.meta.com/horizon/downloads/package/oculus-developer-hub-win (accept license, run installer, sign in).
3. **Headset Developer Mode** — Meta Horizon phone app → Devices → your Quest → Headset settings → Developer Mode → On. Reboot headset.
4. **Connect** — USB-C cable to PC, accept "Allow USB debugging" in headset. Confirm the device shows in MQDH.
5. **Test on Quest** — run `npm run dev:status`, open the `network` URL (e.g. https://192.168.29.216:8081) in the Quest Browser on the same Wi-Fi, accept the local certificate warning, tap *Enter VR*.
   Alternative over USB: `adb reverse tcp:8081 tcp:8081` then open https://localhost:8081 on the headset.

## Submission (WebXR)
Deploy `dist/` via **Vercel** or **GitHub Pages** (public HTTPS URL) and submit that URL on Devpost.

## References
- Competition resources: https://start-developer-competition-26.devpost.com/resources
- IWSDK project setup: https://developers.meta.com/horizon/documentation/web/iwsdk-guide-project-setup/
- Testing your experience (emulator controls): https://iwsdk.dev/guides/02-testing-experience.html
- Device setup: https://developers.meta.com/horizon/documentation/unity/unity-env-device-setup
