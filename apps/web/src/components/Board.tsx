import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { canPlaceWall, legalMoves, pathLength, shortestPath, eq, type Action, type GameState, type Pos, type Wall, type Orientation } from '@wrongway/rules';
import type { Settings } from '../lib';
const GAP=96, BASE=18, TILE=88;
const center=(i:number)=>BASE+i*GAP+TILE/2;
const key=(p:Pos)=>`${p.r}-${p.c}`;
const clamp=(i:number)=>Math.max(0,Math.min(7,i));
const coordinates=(w:Wall)=>w.orientation==='h'?{x:BASE+w.c*GAP,y:BASE+(w.r+1)*GAP-8,width:GAP*2-8,height:16}:{x:BASE+(w.c+1)*GAP-8,y:BASE+w.r*GAP,width:16,height:GAP*2-8};
export type BoardProps={ state:GameState; active:boolean; wallMode:boolean; orientation:Orientation; preview:Wall|null; onPreview:(w:Wall|null)=>void; onMove:(action:Action)=>void; onQuickWall:(w:Wall)=>void; settings:Settings; showPath?:boolean; hint?:Pos|null; showEnemyPath?:boolean; onRotate?:()=>void; keyboardCursor?:Pos|null };
export function Board({state,active,wallMode,orientation,preview,onPreview,onMove,onQuickWall,settings,showPath=false,hint,showEnemyPath=false,onRotate,keyboardCursor}:BoardProps){
  const svg=useRef<SVGSVGElement>(null);const dragging=useRef(false);
  const [cursor,setCursor]=useState<Pos|null>(null);
  const moves=active&&!wallMode&&settings.hints?legalMoves(state):[];
  const legal=preview ? canPlaceWall(state,preview) : false;
  const myIndex=state.turn;
  const path=showPath&&state.winner?shortestPath(state,state.players.findIndex(p=>p.id===state.winner)):showEnemyPath?shortestPath(state,1-myIndex):null;
  const pointerPosition=(e:PointerEvent<SVGSVGElement>):Pos|null=>{
    const element=svg.current;if(!element)return null;const p=element.createSVGPoint();p.x=e.clientX;p.y=e.clientY-(e.pointerType==='touch'?18:0);
    const matrix=element.getScreenCTM()?.inverse();if(!matrix)return null;const local=p.matrixTransform(matrix);
    return {r:clamp(Math.round((local.y-BASE)/GAP)-1),c:clamp(Math.round((local.x-BASE)/GAP)-1)};
  };
  const update=(e:PointerEvent<SVGSVGElement>)=>{const a=pointerPosition(e);if(a)onPreview({...a,orientation});};
  const down=(e:PointerEvent<SVGSVGElement>)=>{if(!active||!wallMode)return;dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId);update(e);};
  const move=(e:PointerEvent<SVGSVGElement>)=>{if(!wallMode||!active)return;if(dragging.current||e.pointerType==='mouse')update(e);};
  const up=(e:PointerEvent<SVGSVGElement>)=>{if(!dragging.current)return;dragging.current=false;const a=pointerPosition(e);if(a){const w={...a,orientation};onPreview(w);if(settings.quickWall&&canPlaceWall(state,w))onQuickWall(w);}};
  useEffect(()=>{if(!wallMode)setCursor(null);},[wallMode]);
  const wallVisual=(w:Wall,i:number,isPreview=false)=>{const r=coordinates(w);const owner=isPreview?myIndex:state.history.slice().reverse().find(h=>h.action.type==='wall'&&eq(h.action.wall,w)&&h.action.wall.orientation===w.orientation)?.playerId==='p2'?1:0;return <g key={`${isPreview?'preview':i}-${w.r}-${w.c}-${w.orientation}`} className={`wall-piece ${isPreview?'wall-ghost':''} ${isPreview?(legal?'valid':'invalid'):''}`}><rect {...r} rx="6" className="wall-shadow" transform="translate(0 5)"/><rect {...r} rx="5" className={`wall-body wall-owner-${owner}`}/><rect x={r.x+2} y={r.y+2} width={r.width-4} height="3" rx="1.5" className="wall-shine"/></g>};
  return <div className={`board-shell ${wallMode?'placing':''} ${state.winner?'game-finished':''}`}>
    <div className="board-outer-glow"/>
    <svg ref={svg} className="game-board" viewBox="0 0 900 900" role="grid" aria-label="9 by 9 Wrong Way board" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>dragging.current=false} onContextMenu={e=>{e.preventDefault();if(wallMode)onRotate?.();}}>
      <defs><linearGradient id="tile" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="var(--tile-top)"/><stop offset="1" stopColor="var(--tile-bottom)"/></linearGradient><radialGradient id="cyanPawn" cx=".32" cy=".22" r=".85"><stop offset="0" stopColor="#ccffff"/><stop offset=".25" stopColor="#54f8f6"/><stop offset="1" stopColor="#068eaf"/></radialGradient><linearGradient id="coralPawn" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffe1e8"/><stop offset=".4" stopColor="#ff7f99"/><stop offset="1" stopColor="#ba355c"/></linearGradient><filter id="pawnGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="13"/></filter></defs>
      <rect width="900" height="900" rx="32" fill="var(--board-bg)"/>
      {Array.from({length:81},(_,i)=>{const r=Math.floor(i/9),c=i%9,p={r,c},movable=moves.some(x=>eq(x,p));return <g key={`${r}-${c}`} role="gridcell" aria-label={`Row ${r+1}, column ${c+1}${movable?', legal move':''}`}><rect x={BASE+c*GAP} y={BASE+r*GAP} width={TILE} height={TILE} rx="10" className={`tile ${r===0?'tile-goal-cyan':''} ${r===8?'tile-goal-coral':''}`} fill="url(#tile)"/><rect x={BASE+c*GAP+1} y={BASE+r*GAP+1} width={TILE-2} height={TILE-2} rx="10" fill="none" stroke="var(--tile-stroke)" strokeWidth="1"/>{movable&&<><circle cx={center(c)} cy={center(r)} r="25" className="move-indicator"/><circle cx={center(c)} cy={center(r)} r="9" fill="var(--cyan)" opacity=".85"/></>}{hint&&eq(hint,p)&&<circle cx={center(c)} cy={center(r)} r="32" className="hint-ring"/>}{(keyboardCursor||cursor)&&eq((keyboardCursor||cursor)!,p)&&<rect x={BASE+c*GAP+3} y={BASE+r*GAP+3} width={TILE-6} height={TILE-6} rx="10" stroke="white" strokeWidth="3" fill="none"/>}<rect x={BASE+c*GAP} y={BASE+r*GAP} width={TILE} height={TILE} fill="transparent" role="button" tabIndex={-1} style={{cursor:movable?'pointer':'default'}} onClick={()=>{if(active&&!wallMode&&legalMoves(state).some(v=>eq(v,p)))onMove({type:'move',to:p});else setCursor(p);}}/></g>})}
      {path&&<polyline points={path.map(p=>`${center(p.c)},${center(p.r)}`).join(' ')} fill="none" stroke="var(--gold)" strokeWidth="5" strokeDasharray="5 20" strokeLinecap="round" opacity=".7" className="path-reveal"/>}
      {wallMode&&active&&Array.from({length:64},(_,i)=>{const r=Math.floor(i/8),c=i%8,w={r,c,orientation};if(!canPlaceWall(state,w))return null;const box=coordinates(w);return <rect key={`${r}-${c}`} {...box} rx="5" fill="var(--cyan)" opacity=".18" stroke="var(--cyan)" strokeWidth="2" strokeDasharray="8 9" pointerEvents="none"/>;})}
      {state.walls.map((w,i)=>wallVisual(w,i))}
      {preview&&wallMode&&active&&wallVisual(preview,-1,true)}
      {state.players.map((p,i)=><g key={p.id} className={`pawn pawn-${i} ${state.history.at(-1)?.playerId===p.id&&state.history.at(-1)?.action.type==='move'?'pawn-moved':''}`} style={{transform:`translate(${center(p.pawn.c)}px, ${center(p.pawn.r)}px)`}}><ellipse cy="20" rx="29" ry="10" fill="#000" opacity=".45" filter="url(#pawnGlow)"/><circle r="37" fill={i===0?'var(--cyan)':'var(--coral)'} opacity=".33" filter="url(#pawnGlow)" className="pawn-aura"/>{i===0?<><circle r="27" fill="url(#cyanPawn)" stroke="#b2ffff" strokeWidth="2"/><ellipse cx="-10" cy="-12" rx="10" ry="6" fill="white" opacity=".5" transform="rotate(-35 -10 -12)"/></>:<><rect x="-23" y="-23" width="46" height="46" rx="7" fill="url(#coralPawn)" stroke="#ffd1d9" strokeWidth="2" transform="rotate(45)"/><path d="M -10,-21 Q 0,-29 10,-19" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".45"/></>}</g>)}
    </svg>
    <div className="board-labels"><span>01</span><span>THE CROSSROADS</span><span>09</span></div>
    {wallMode&&preview&&!legal&&<div className="board-error" role="status">That wall would overlap or block a path</div>}
  </div>;
}
export { key as posKey };
