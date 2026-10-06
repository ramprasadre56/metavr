# Devpost submission draft — Focus Desk

> Copy each section into the matching field on the Devpost "Edit project" form.
> Items marked **[YOU]** need your input before submitting.

## Project name
Focus Desk

## Elevator pitch (≤200 chars)
A seated, hands-first VR desk: pinch tasks across a spatial kanban, start focus sessions by touching a breathing orb, and grow a garden that rewards your streak.

## Track / Division
- Track: **Productivity**
- Division: **New Experience** (conceived and built after Sept 24, 2026)
- Special awards it fits: Best Reason to Come Back, Best First Five Minutes

## Try it out
- Live app (WebXR, open in Meta Quest Browser): https://ramprasadre56.github.io/metavr/
- Source: https://github.com/ramprasadre56/metavr

## Video demo **[YOU]**
Record < 3 min on Quest (or the IWER emulator), upload to YouTube/Vimeo as Public, paste link.
Suggested shot list:
1. 0:00–0:15 Cold start: put on headset, desk appears at arm's reach, onboarding card, pinch to dismiss.
2. 0:15–0:50 Pinch-drag "Plan the day" from To do → Doing → Done; sprout grows; streak becomes 1.
3. 0:50–1:40 Pinch the orb (1-min demo duration), orb breathes, ring shrinks, chime, flower blooms.
4. 1:40–2:10 "+ Task", "Clear done", "Recenter" after turning in the chair.
5. 2:10–2:40 Exit and re-enter: tasks, garden and streak persist. Closing line on daily habit.

## Built with
iwsdk, webxr, three.js, typescript, vite, github-pages, github-actions

## About the project (story)

### Inspiration
Most "productivity in VR" means floating 2D windows. We wanted something designed for one specific daily moment: sitting down to start work. Focus Desk is the ten-minute ritual you can do in an airplane seat: decide what matters, start one focused block, and see visible proof that you showed up.

### What it does
- **Spatial kanban, hands-first.** Task cards sit on a board at seated arm's reach. Pinch a card and move it from To do → Doing → Done; it snaps into the nearest column.
- **Focus orb.** Pinch (or poke) the orb to start a focus session (1/5/15/25 min). The orb breathes while you focus and its ring shrinks as time runs down. Pinch again to pause and resume.
- **Desk garden.** Every completed task plants a sprout and every finished session blooms a flower. A day streak and today's counts sit above the garden, giving you a reason to come back tomorrow.
- **Built for seated use.** No locomotion. Everything sits within a ~2 ft reach envelope and a narrow field of view, and the desk re-anchors in front of you on entry or with "Recenter".
- **Fast in and out.** Cold start straight to the desk. State (cards, garden, streak) persists locally between sessions.

### How we built it
- Meta's **Immersive Web SDK (IWSDK)** on Three.js with its ECS: custom `TaskCard` and `DeskButton` components and a `FocusDeskSystem`.
- Hand tracking with pinch-to-grab (`DistanceGrabbable`, `useHandPinchForGrab`) for cards and `RayInteractable` + `PokeInteractable` for buttons, so the whole app works without controllers.
- Head-relative, yaw-only anchoring keeps the board inside a comfortable FoV on every Quest device.
- Canvas-texture text panels, procedural plant meshes, and Web Audio synthesized UI sounds (no third-party assets).
- Tested in the IWER Quest 3 emulator. Deployed to GitHub Pages via GitHub Actions on every push.

### Challenges we ran into
**[YOU — add your real experience, e.g. tuning pinch-drag snapping, text legibility at arm's length]**

### Accomplishments that we're proud of
A complete loop (plan → focus → reward) that fits in one bus stop, fully usable with hands only.

### What we learned
**[YOU]**

### What's next for Focus Desk
- Passthrough/MR mode: anchor the board to your real desk using plane detection.
- Voice task entry and custom task text.
- Gaze + pinch selection on supported devices; accessibility high-contrast mode.
- Weekly garden "seasons" and shareable streak cards.
- Target launch: **[YOU — e.g. Meta Horizon Store web app listing, Q1 2027]**
