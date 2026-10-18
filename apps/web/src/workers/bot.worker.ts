import { allLegalWalls, applyAction, legalMoves, pathLength, shortestPath, type Action, type GameState, type Wall } from '@wrongway/rules';

type Difficulty = 'easy' | 'medium' | 'hard';
const random = <T,>(a:T[])=>a[Math.floor(Math.random()*a.length)];
function estimate(state: GameState, me:number) { const them=1-me;return (pathLength(state,them)-pathLength(state,me))*18 + (state.players[me].walls-state.players[them].walls)*1.6 + (state.winner===state.players[me].id?10000:state.winner?-10000:0); }
function possible(state: GameState, depth=0):Action[] {
  if(state.winner)return [];
  const moves:Action[]=legalMoves(state).map(to=>({type:'move',to}));
  if(!state.players[state.turn].walls) return moves;
  const self=shortestPath(state,state.turn)??[], enemy=shortestPath(state,1-state.turn)??[];
  const pathCells = [...self,...enemy];
  const interesting = new Set<string>();
  for(const p of pathCells)for(let r=p.r-2;r<=p.r+1;r++)for(let c=p.c-2;c<=p.c+1;c++)if(r>=0&&c>=0&&r<8&&c<8){interesting.add(`${r},${c},h`);interesting.add(`${r},${c},v`);}
  let walls=allLegalWalls(state).filter(w=>interesting.has(`${w.r},${w.c},${w.orientation}`));
  const me=state.turn;walls=walls.map(w=>({w,score:estimate(applyAction(state,{type:'wall',wall:w}),me)})).sort((a,b)=>b.score-a.score).slice(0,depth?5:9).map(v=>v.w);
  return [...moves,...walls.map(wall=>({type:'wall' as const,wall}))];
}
function search(state:GameState,depth:number,alpha:number,beta:number,me:number):number {
  if(depth===0||state.winner)return estimate(state,me);
  const maximizing=state.turn===me;
  let best=maximizing?-Infinity:Infinity;
  for(const move of possible(state,depth)){
    const score=search(applyAction(state,move),depth-1,alpha,beta,me);
    best=maximizing?Math.max(best,score):Math.min(best,score);
    if(maximizing)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);
    if(beta<=alpha)break;
  }
  return Number.isFinite(best)?best:estimate(state,me);
}
function choose(state:GameState,difficulty:Difficulty):Action {
  const self=state.turn;const moveCandidates:Action[]=legalMoves(state).map(to=>({type:'move',to}));
  const distMoves=moveCandidates.map(action=>({action,score:pathLength(applyAction(state,action),self)})).sort((a,b)=>a.score-b.score);
  if(difficulty==='easy'){
    if(Math.random()<.18 && state.players[self].walls){const w=allLegalWalls(state); if(w.length)return {type:'wall',wall:random(w)};}
    return random(distMoves.slice(0,Math.min(2,distMoves.length))).action;
  }
  if(difficulty==='medium'){
    const before=pathLength(state,1-self);const walls=allLegalWalls(state);
    let choice:Wall|null=null;let gain=0;
    for(const w of walls){const after=pathLength(applyAction(state,{type:'wall',wall:w}),1-self);if(after-before>gain){gain=after-before;choice=w;}}
    if(choice && gain>=2 && (pathLength(state,self)>=pathLength(state,1-self)-2))return {type:'wall',wall:choice};
    return distMoves[0].action;
  }
  const candidates=possible(state);
  let best=candidates[0], high=-Infinity;
  // Depth 3 with a restricted path-relevant wall beam; runs outside the UI thread.
  for(const move of candidates){const s=applyAction(state,move);const score=search(s,2,-Infinity,Infinity,self);if(score>high){best=move;high=score;}}
  return best??distMoves[0].action;
}
self.onmessage=(e:MessageEvent<{state:GameState,difficulty:Difficulty,request:number}>)=>{
  try{ const action=choose(e.data.state,e.data.difficulty); self.postMessage({request:e.data.request,action}); }
  catch{const dest=legalMoves(e.data.state)[0];self.postMessage({request:e.data.request,action:{type:'move',to:dest}});}
};
