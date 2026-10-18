# QA checklist — touch wall dragging and small phones

Test on 320, 360, 375, 390, 430px portrait and 568×320 landscape; Android Chrome, iOS Safari and installed PWA, each at 100% and 125% text size.

- [ ] Board stays square; all 81 squares, goals and 10-wall inventory remain visible; no horizontal overflow.
- [ ] In pawn mode, tap every legal destination in corners/edges. Illegal taps never mutate state. Jump straight, diagonal at edge, and diagonal behind an obstructing wall all work.
- [ ] Enable wall mode with the lower thumb-reachable button. Touch near a junction; a preview snaps to one of the 64 anchors and sits above the finger.
- [ ] Drag slowly between anchors: no body scroll, pull-to-refresh or page zoom; ghost follows the nearest anchor without jitter.
- [ ] Drag rapidly across the board and release: ghost remains on the last slot, never off-board. Release confirms only when Quick Wall mode is enabled.
- [ ] Rotate a candidate wall using the Rotate button; verify legal / illegal preview updates immediately.
- [ ] Try a same-line overlap, mid-point cross, and path-trapping wall: each is rejected with red feedback; wall inventory and active turn do not change.
- [ ] Place a legal wall with Confirm; exactly one wall is added and count drops by one. Cancel must not spend a wall.
- [ ] Try a move while the opponent is thinking and while an online move is pending: it must not be accepted.
- [ ] Background app for 10 seconds in an online room; reconnect, restore session and preserve seat. Disconnect for more than 60 seconds; verify forfeit.
- [ ] Test 30/60-second clocks; timeout makes a legal pawn move on the authoritative server.
- [ ] Toggle Quick Wall mode, haptics, sound and reduced motion; effects update with no screen reload.
- [ ] Install PWA, use airplane mode, open bot/pass-and-play and play an entire offline round; online clearly indicates reconnection.
- [ ] VoiceOver/TalkBack: clear button purpose and cell coordinates; keyboard: arrows/W/R/Enter/Esc navigation.
- [ ] Attempt rotation, browser Back, landscape change and keyboard opening during drag. No ghost should remain stuck after cancel/pointercancel.

**Known constraints:** 44px board *square* hit targets cannot fit 9 columns in a 320px viewport (9×44px = 396px), so the scaled 9×9 board necessarily uses smaller tiles; maintain 44px for action buttons and provide keyboard alternatives.
