/** Pure, deterministic rule engine shared by server, browser and bot. */
export const SIZE = 9;
export type Pos = { r: number; c: number };
export type Orientation = 'h' | 'v';
export type Wall = Pos & { orientation: Orientation };
export type Goal = 'north' | 'south' | 'west' | 'east';
export type Player = { id: string; name: string; pawn: Pos; goal: Goal; walls: number; color: string };
export type Move = { type: 'move'; to: Pos };
export type Place = { type: 'wall'; wall: Wall };
export type Action = Move | Place;
export type History = { playerId: string; action: Action; at: number };
export type GameState = { players: Player[]; walls: Wall[]; turn: number; winner: string | null; history: History[] };
const dirs: Pos[] = [{ r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }];
export const eq = (a: Pos, b: Pos) => a.r === b.r && a.c === b.c;
export const inBounds = (p: Pos) => Number.isInteger(p.r) && Number.isInteger(p.c) && p.r >= 0 && p.r < SIZE && p.c >= 0 && p.c < SIZE;
export const validAnchor = (p: Pos) => Number.isInteger(p.r) && Number.isInteger(p.c) && p.r >= 0 && p.r < SIZE - 1 && p.c >= 0 && p.c < SIZE - 1;
export function initialGame(names: string[] = ['Player 1', 'Player 2']): GameState {
  if (names.length !== 2) throw new Error('Wrong Way is a two-player game');
  return { players: [
    { id: 'p1', name: names[0], pawn: { r: 8, c: 4 }, goal: 'north', walls: 10, color: 'cyan' },
    { id: 'p2', name: names[1], pawn: { r: 0, c: 4 }, goal: 'south', walls: 10, color: 'coral' }
  ], walls: [], turn: 0, winner: null, history: [] };
}
export function atGoal(p: Pos, goal: Goal): boolean {
  return goal === 'north' ? p.r === 0 : goal === 'south' ? p.r === 8 : goal === 'west' ? p.c === 0 : p.c === 8;
}
/** True if a one-tile edge is open. The walls straddle two neighboring edges. */
export function openEdge(a: Pos, b: Pos, walls: Wall[]): boolean {
  if (!inBounds(a) || !inBounds(b) || Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return false;
  if (a.r !== b.r) {
    const line = Math.min(a.r, b.r);
    return !walls.some(w => w.orientation === 'h' && w.r === line && (w.c === a.c || w.c + 1 === a.c));
  }
  const line = Math.min(a.c, b.c);
  return !walls.some(w => w.orientation === 'v' && w.c === line && (w.r === a.r || w.r + 1 === a.r));
}
/** Ignore pawns for the mandatory path-to-goal test (official Quoridor interpretation). */
export function shortestPath(state: GameState, playerIndex: number): Pos[] | null {
  const player = state.players[playerIndex];
  if (!player) return null;
  const queue: Pos[] = [player.pawn];
  const key = (p: Pos) => `${p.r},${p.c}`;
  const seen = new Set<string>([key(player.pawn)]);
  const parent = new Map<string, Pos>();
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    if (atGoal(p, player.goal)) {
      const path = [p]; let current = p;
      while (!eq(current, player.pawn)) { current = parent.get(key(current))!; path.unshift(current); }
      return path;
    }
    for (const d of dirs) {
      const next = { r: p.r + d.r, c: p.c + d.c }; const k = key(next);
      if (!seen.has(k) && openEdge(p, next, state.walls)) { parent.set(k, p); seen.add(k); queue.push(next); }
    }
  }
  return null;
}
export const pathLength = (state: GameState, i: number): number => (shortestPath(state, i)?.length ?? 1000) - 1;
export function canPlaceWall(state: GameState, wall: Wall, playerIndex = state.turn): boolean {
  if (state.winner || !validAnchor(wall) || (wall.orientation !== 'h' && wall.orientation !== 'v') || (state.players[playerIndex]?.walls ?? 0) < 1) return false;
  // Same orientation segments cannot overlap, perpendicular walls cannot cross centers.
  for (const existing of state.walls) {
    if (existing.orientation === wall.orientation) {
      if (wall.orientation === 'h' && existing.r === wall.r && Math.abs(existing.c - wall.c) <= 1) return false;
      if (wall.orientation === 'v' && existing.c === wall.c && Math.abs(existing.r - wall.r) <= 1) return false;
    } else if (existing.r === wall.r && existing.c === wall.c) return false;
  }
  const next = { ...state, walls: [...state.walls, wall] };
  return state.players.every((_, i) => shortestPath(next, i) !== null);
}
/** Handles straight jumps; a blocked space behind an adjacent pawn unlocks side-steps. */
export function legalMoves(state: GameState, playerIndex = state.turn): Pos[] {
  if (state.winner || !state.players[playerIndex]) return [];
  const own = state.players[playerIndex].pawn;
  const occupied = (p: Pos) => state.players.some((pl, i) => i !== playerIndex && eq(pl.pawn, p));
  const legal: Pos[] = [];
  const add = (p: Pos) => { if (!legal.some(v => eq(v, p))) legal.push(p); };
  for (const d of dirs) {
    const adjacent = { r: own.r + d.r, c: own.c + d.c };
    if (!openEdge(own, adjacent, state.walls)) continue;
    if (!occupied(adjacent)) { add(adjacent); continue; }
    const behind = { r: adjacent.r + d.r, c: adjacent.c + d.c };
    if (openEdge(adjacent, behind, state.walls) && !occupied(behind)) { add(behind); continue; }
    // Perpendicular steps are relative to the jumped pawn, not from our original tile.
    const sides = d.r !== 0 ? [{ r: 0, c: -1 }, { r: 0, c: 1 }] : [{ r: -1, c: 0 }, { r: 1, c: 0 }];
    for (const side of sides) {
      const candidate = { r: adjacent.r + side.r, c: adjacent.c + side.c };
      if (openEdge(adjacent, candidate, state.walls) && !occupied(candidate)) add(candidate);
    }
  }
  return legal;
}
/** Reject any invalid action; all writes must go through this function on the server. */
export function applyAction(state: GameState, action: Action, at = Date.now()): GameState {
  if (state.winner) throw new Error('Game already finished');
  const player = state.players[state.turn];
  if (!player) throw new Error('Invalid turn');
  const players = state.players.map(p => ({ ...p, pawn: { ...p.pawn } }));
  let walls = state.walls;
  if (action?.type === 'move') {
    if (!action.to || !legalMoves(state).some(p => eq(p, action.to))) throw new Error('Illegal pawn move');
    players[state.turn].pawn = { ...action.to };
  } else if (action?.type === 'wall') {
    if (!action.wall || !canPlaceWall(state, action.wall)) throw new Error('Illegal wall placement');
    players[state.turn].walls--;
    walls = [...state.walls, { ...action.wall }];
  } else throw new Error('Unknown action');
  const winner = atGoal(players[state.turn].pawn, player.goal) ? player.id : null;
  return { players, walls, turn: winner ? state.turn : (state.turn + 1) % players.length, winner, history: [...state.history, { playerId: player.id, action, at }] };
}
export function allLegalWalls(state: GameState, playerIndex = state.turn): Wall[] {
  if ((state.players[playerIndex]?.walls ?? 0) === 0) return [];
  const result: Wall[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) for (const orientation of ['h', 'v'] as const) {
    const wall = { r, c, orientation }; if (canPlaceWall(state, wall, playerIndex)) result.push(wall);
  }
  return result;
}
