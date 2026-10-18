import { describe, expect, it } from 'vitest';
import { initialGame, legalMoves, applyAction, canPlaceWall, openEdge, shortestPath, type Wall } from './index.js';
describe('Wrong Way rules', () => {
  it('starts correctly for exactly two players', () => {
    expect(initialGame().players.map(p => p.walls)).toEqual([10,10]);
    expect(()=>initialGame(['a','b','c','d'])).toThrow();
  });
  it('starts with three legal moves and alternates turns', () => {
    const game = initialGame(); expect(legalMoves(game)).toHaveLength(3);
    const next = applyAction(game, {type:'move',to:{r:7,c:4}}); expect(next.turn).toBe(1);
    expect(game.players[0].pawn.r).toBe(8);
  });
  it('jumps straight over adjacent opponent', () => {
    const s = initialGame(); s.players[0].pawn={r:4,c:4}; s.players[1].pawn={r:3,c:4};
    expect(legalMoves(s)).toContainEqual({r:2,c:4});
    expect(legalMoves(s)).not.toContainEqual({r:3,c:4});
  });
  it('uses both diagonal sidesteps if jump is blocked by a wall', () => {
    const s = initialGame(); s.players[0].pawn={r:4,c:4}; s.players[1].pawn={r:3,c:4};
    s.walls.push({r:2,c:4,orientation:'h'});
    expect(legalMoves(s)).toContainEqual({r:3,c:3});
    expect(legalMoves(s)).toContainEqual({r:3,c:5});
    expect(legalMoves(s)).not.toContainEqual({r:2,c:4});
  });
  it('sidesteps at board edge but not through side walls', () => {
    const s=initialGame(); s.players[0].pawn={r:1,c:4};s.players[1].pawn={r:0,c:4};
    s.walls.push({r:0,c:4,orientation:'v'});
    expect(legalMoves(s)).toContainEqual({r:0,c:3});
    expect(legalMoves(s)).not.toContainEqual({r:0,c:5});
  });
  it('prevents crossing and overlapping but allows end-to-end walls', () => {
    const s=initialGame();s.walls.push({r:3,c:3,orientation:'h'});
    expect(canPlaceWall(s,{r:3,c:3,orientation:'v'})).toBe(false);
    expect(canPlaceWall(s,{r:3,c:4,orientation:'h'})).toBe(false);
    expect(canPlaceWall(s,{r:3,c:5,orientation:'h'})).toBe(true);
  });
  it('rejects walls that trap a pawn; preserves goal path', () => {
    const s=initialGame();s.players[0].pawn={r:8,c:0};
    s.walls=[{r:7,c:0,orientation:'h'}];
    expect(canPlaceWall(s,{r:7,c:0,orientation:'v'})).toBe(false);
    expect(shortestPath(s,0)).not.toBeNull();
  });
  it('stops movement across wall and recognizes victory', () => {
    const s=initialGame();s.walls=[{r:7,c:4,orientation:'h'}];
    expect(openEdge({r:8,c:4},{r:7,c:4},s.walls)).toBe(false);
    const w=initialGame();w.players[0].pawn={r:1,c:4};w.players[1].pawn={r:0,c:5};
    expect(applyAction(w,{type:'move',to:{r:0,c:4}}).winner).toBe('p1');
  });
  it('does not mutate state on illegal actions', () => {
    const s=initialGame();expect(()=>applyAction(s,{type:'move',to:{r:0,c:0}})).toThrow();
    expect(s.history).toHaveLength(0);
  });
});
