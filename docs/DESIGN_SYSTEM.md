# Wrong Way — UI and interaction specification

## Visual DNA

Dark, cinematic midnight slate, softly illuminated cyan/coral pieces, a framed tabletop with a raised metallic/wood trim and restrained dust-light particles. Everything is CSS/SVG—no heavy image payloads. Paper is an optional light theme.

| Token | Dark | Light / Paper | Use |
|---|---|---|---|
| Background | `#090E17` | `#F4F0E9` | Screen and vignette |
| Surface | `#121C29` | `#FFFDF8` | Modal / cards |
| Secondary surface | `#182436` | `#EAE4DA` | Buttons / stats |
| Electric cyan | `#40E7EA` | `#007F9A` | Player 1, active controls, legal moves |
| Coral | `#FF718E` | `#C33C67` | Player 2 and accent |
| Warm metallic | `#D7AA72` | `#87603A` | Placed walls and hints |
| Text | `#EAF2FA` | `#273545` | Primary typography |
| Muted | `#8495AD` | `#667584` | Supporting typography |

### Type and layout

Display: Sora, fallback DM Sans, system sans-serif. Body: DM Sans, fallback Inter / system sans-serif. Hero: fluid 35–70px, titles 20–48px, body 12–15px, labels 9–11px uppercase tracking 1–2px. Spacing is an 8px baseline with 4px micro-spacing. Corners: controls 10–13px, content cards 17–24px. Tap buttons minimum 44px.

Responsive breakpoints: 320–580px small phone, 581–799px tablet/landscape, 800–1099px compact desktop, 1100px+ three-column board + side panels. On a 320px phone, board tile targets are physically smaller than 44px to keep all 81 squares visible; users can enlarge the browser view or use keyboard cursor input.

## Core components

- `Brand` — small orb walking inside a square tabletop stamp, two-tone title.
- `ModeCard` — oversized three-choice menu, CSS border-glow and press-scale.
- `Board` — 900-unit SVG viewBox, 9×9 beveled tiles, 2-color goal rows, polygon/circle pawns, raised 2-cell walls, 64 wall anchors per orientation, magnetic snap preview and path trace.
- `PlayerCard` — shape-coded avatar, 10 wall-pips, steps-to-goal, turn pulse, clock.
- `Overlay` — focused dialogs with backdrop blur, scrollable settings and full-screen victory.
- `Tutorial` — three clickable practice states (move, place, jump).
- `CodeInput` — six segmented inputs, paste, auto-uppercase and focus advancement.

## Motion schedule

| Gesture | Timing | Easing / visual |
|---|---|---|
| Card hover | 200ms | TranslateY −5px, glow |
| Pawn move | 290ms | `cubic-bezier(.2,.75,.24,1.12)`, contact shadow and aura |
| Pawn landing | 340ms | Transform/opacity pop |
| Legal square | 1.5s loop | Pulsing cyan ring |
| Wall ghost | 130ms | Fade/scale into snapped slot |
| Illegal ghost | 280ms | Red + brief lateral shake |
| Rematch modal | 220–400ms | Slide/fade |
| Reaction | 1.8s | Float/fade upward |
| Victory confetti | 3.4s | Distributed CSS falling particles |
| Ambient dust | 22s | Slow translational drift |

The desktop board has a restrained 7° CSS perspective; wall-placement mode and all touch-sized breakpoints remove tilt so the finger-to-SVG inverse transform stays accurate. Reduced-motion support disables animations, particle motion, and tilt. GPU-friendly transforms/opacity are used for pawns and most effects.

### Haptics

Pawn move: 12ms tick. Invalid move: 20ms. Wall confirm: 15–30–35ms pulse. Win: 30–60–30–60–80ms pattern. Unsupported browsers quietly ignore vibration.

### Sound palette (synthesized Web Audio)

| Cue | Frequency / character | Behavior |
|---|---|---|
| Tap | 460 Hz sine | 60ms soft tick |
| Pawn slide | 340 / 520 Hz sine | Low-volume paired tones |
| Wall drop | 95 Hz triangle + 68 Hz sine | 140–180ms warm thump |
| Invalid | 125 Hz square | 150ms muted error |
| Turn | 570 / 780 Hz sine | Short ascending chime |
| Win | 523 / 659 / 784 Hz | Triad stinger |
| Lose | 260 / 210 Hz | Descending soft tone |
| Ambient | 110 / 164.81 / 220 / 329.63 Hz | Continuous quiet drone after gesture |

SFX synthesize lazily (no downloaded audio). Music uses a near-silent sine layer, configurable via master volume and music setting. Automatic sound is gated behind a user gesture, respecting browsers' autoplay rules.

## Accessibility and keyboard

The cyan circle and coral diamond have different silhouettes. SVG board squares carry coordinate labels; legal cells announce their state. Focus outlines use the theme accent. W toggles wall placement, R/right click rotates, Enter confirms selected keyboard coordinate/wall, Escape cancels, arrow keys move keyboard focus across cells. Screen-safe-area insets are used in portrait. Modes hide 3D tilt for accurate touch. Large text, high contrast and reduced motion are user settings; system reduced-motion is also respected.
