import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, legalMoves, applyAction, canPlaceWall, openEdge, shortestPath } from '../dist/index.js';
test('exactly two players, correct setup',()=>{ const s=initialGame();assert.deepEqual(s.players.map(x=>x.walls),[10,10]);assert.throws(()=>initialGame(['A','B','C','D']));});
test('initial legal moves and turns',()=>{const s=initialGame();assert.equal(legalMoves(s).length,3);const b=applyAction(s,{type:'move',to:{r:7,c:4}});assert.equal(b.turn,1);assert.equal(s.players[0].pawn.r,8);});
test('jump straight without walls',()=>{const s=initialGame();s.players[0].pawn={r:4,c:4};s.players[1].pawn={r:3,c:4};assert(legalMoves(s).some(p=>p.r===2&&p.c===4));});
test('jump diagonally when behind opponent blocked',()=>{const s=initialGame();s.players[0].pawn={r:4,c:4};s.players[1].pawn={r:3,c:4};s.walls.push({r:2,c:4,orientation:'h'});const m=legalMoves(s);assert(m.some(p=>p.r===3&&p.c===3));assert(m.some(p=>p.r===3&&p.c===5));assert(!m.some(p=>p.r===2&&p.c===4));});
test('diagonal at edge respects side walls',()=>{const s=initialGame();s.players[0].pawn={r:1,c:4};s.players[1].pawn={r:0,c:4};s.walls=[{r:0,c:4,orientation:'v'}];assert(legalMoves(s).some(p=>p.r===0&&p.c===3));assert(!legalMoves(s).some(p=>p.r===0&&p.c===5));});
test('wall crossing, overlap and same-line end to end',()=>{const s=initialGame();s.walls=[{r:3,c:3,orientation:'h'}];assert(!canPlaceWall(s,{r:3,c:3,orientation:'v'}));assert(!canPlaceWall(s,{r:3,c:4,orientation:'h'}));assert(canPlaceWall(s,{r:3,c:5,orientation:'h'}));});
test('walls block edges and never mutate illegal state',()=>{const s=initialGame();s.walls=[{r:7,c:4,orientation:'h'}];assert(!openEdge({r:8,c:4},{r:7,c:4},s.walls));assert.throws(()=>applyAction(s,{type:'move',to:{r:7,c:4}}));assert.equal(s.history.length,0);});
test('both players must retain path to goal',()=>{const s=initialGame();s.players[0].pawn={r:4,c:4};s.players[1].pawn={r:3,c:4};assert(shortestPath(s,0));assert(shortestPath(s,1));const b=applyAction(s,{type:'wall',wall:{r:3,c:3,orientation:'h'}});assert(shortestPath(b,0));assert(shortestPath(b,1));});
test('winning on opposite row',()=>{const s=initialGame();s.players[0].pawn={r:1,c:4};s.players[1].pawn={r:0,c:5};const b=applyAction(s,{type:'move',to:{r:0,c:4}});assert.equal(b.winner,'p1');assert.throws(()=>applyAction(b,{type:'move',to:{r:1,c:4}}));});


test('wall anchors reject out-of-bounds and illegal orientation',()=>{
 const s=initialGame();
 for(const w of [{r:-1,c:0,orientation:'h'},{r:8,c:0,orientation:'h'},{r:0,c:8,orientation:'v'},{r:3,c:3,orientation:'x'}]) assert(!canPlaceWall(s,w));
});

test('random legal games preserve the wall/path/turn invariants',()=>{
 let seed=27419; const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let game=0;game<30;game++){
  let s=initialGame();let wallMoves=0;
  for(let turn=0;turn<60&&!s.winner;turn++){
   const who=s.turn,moveOptions=legalMoves(s);
   assert(moveOptions.length>0);
   let action={type:'move',to:moveOptions[Math.floor(rnd()*moveOptions.length)]};
   if(s.players[who].walls>0&&rnd()<.36){
    for(let tries=0;tries<16;tries++){
     const wall={r:Math.floor(rnd()*8),c:Math.floor(rnd()*8),orientation:rnd()<.5?'h':'v'};
     if(canPlaceWall(s,wall)){action={type:'wall',wall};wallMoves++;break;}
    }
   }
   const before=s;
   s=applyAction(s,action,turn);
   assert(s.players.every((p,i)=>p.walls===10-s.history.filter(h=>h.playerId===p.id&&h.action.type==='wall').length));
   assert(s.players.every((p,i)=>shortestPath(s,i)));
   assert.equal(s.history.length,turn+1);
   assert.equal(s.turn,s.winner?who:1-who);
   assert.notEqual(s,before);
  }
  assert(s.walls.length===wallMoves);
 }
});
