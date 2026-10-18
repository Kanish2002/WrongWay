import { initialGame, shortestPath, pathLength, type GameState, type Pos, type Wall } from '@wrongway/rules';
export type Difficulty = 'easy'|'medium'|'hard';
export type Mode = 'pass'|'bot'|'online';
export type Settings = { theme:'dark'|'paper'; sound:boolean; music:boolean; volume:number; haptics:boolean; hints:boolean; steps:boolean; quickWall:boolean; timer:0|30|60; reducedMotion:boolean; largeText:boolean; highContrast:boolean; hidePass:boolean; language:'en' };
export const defaults:Settings={theme:'dark',sound:true,music:false,volume:55,haptics:true,hints:true,steps:true,quickWall:false,timer:0,reducedMotion:typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,largeText:false,highContrast:false,hidePass:false,language:'en'};
export function saved<T>(key:string,fallback:T):T { try{const d=localStorage.getItem(key);return d?{...fallback,...JSON.parse(d)}:fallback;}catch{return fallback;} }
export function init(names?:string[],first=0){const state=initialGame(names);state.turn=first;return state;}
export function formatWall(w:Wall){return `${String.fromCharCode(97+w.c)}${9-w.r}${w.orientation.toUpperCase()}`;}
export function formatMove(p:Pos){return `${String.fromCharCode(97+p.c)}${9-p.r}`;}
export function getSteps(state:GameState,i:number){return pathLength(state,i);}
export function winPath(state:GameState){return state.winner ? shortestPath(state,state.players.findIndex(p=>p.id===state.winner)) : null;}
export type AudioCue='tap'|'slide'|'wall'|'invalid'|'turn'|'win'|'lose'|'tick';
let ctx:AudioContext|null=null;
export function audio(cue:AudioCue,settings:Settings){if(!settings.sound||settings.volume===0)return;try{
  ctx??=new AudioContext();if(ctx.state==='suspended')void ctx.resume();
  const notes:Record<AudioCue,[number,number,OscillatorType,number][]>={tap:[[460,.06,'sine',.04]],slide:[[340,.08,'sine',.035],[520,.09,'sine',.025]],wall:[[95,.14,'triangle',.11],[68,.18,'sine',.09]],invalid:[[125,.15,'square',.025]],turn:[[570,.07,'sine',.04],[780,.12,'sine',.035]],win:[[523,.18,'sine',.05],[659,.2,'sine',.05],[784,.24,'sine',.045]],lose:[[260,.17,'sine',.04],[210,.26,'sine',.035]],tick:[[650,.035,'sine',.02]]};
  notes[cue].forEach(([freq,dur,type,volume],i)=>{const o=ctx!.createOscillator(),g=ctx!.createGain(),start=ctx!.currentTime+i*.05;o.type=type;o.frequency.setValueAtTime(freq,start);g.gain.setValueAtTime(.001,start);g.gain.exponentialRampToValueAtTime(Math.max(.001,volume*settings.volume/100),start+.01);g.gain.exponentialRampToValueAtTime(.001,start+dur);o.connect(g).connect(ctx!.destination);o.start(start);o.stop(start+dur+.02);});
}catch{/* Browser may disallow audio before interaction. */}}
export function buzz(settings:Settings,pattern:number|number[]=10){if(settings.haptics && 'vibrate' in navigator)navigator.vibrate(pattern);}
export type Stats={played:number;wins:number;losses:number;botWins:Record<Difficulty,number>;moves:number;walls:number};
export const blankStats:Stats={played:0,wins:0,losses:0,botWins:{easy:0,medium:0,hard:0},moves:0,walls:0};

let ambientVoices:OscillatorNode[]=[];
let ambientAmp:GainNode|null=null;
/** A tiny synthesized drone: no download, starts only after a user gesture. */
export function updateAmbient(settings:Settings){
  if(!settings.music || settings.volume===0){ambientVoices.forEach(v=>{try{v.stop();v.disconnect();}catch{}});ambientVoices=[];ambientAmp?.disconnect();ambientAmp=null;return;}
  try{
    ctx??=new AudioContext();if(ctx.state==='suspended')void ctx.resume();
    if(ambientVoices.length){ambientAmp?.gain.setTargetAtTime(settings.volume/100*.013,ctx.currentTime,.4);return;}
    ambientAmp=ctx.createGain();ambientAmp.gain.value=0;ambientAmp.connect(ctx.destination);ambientAmp.gain.setTargetAtTime(settings.volume/100*.013,ctx.currentTime,1.5);
    [110,164.81,220,329.63].forEach((hz,i)=>{const o=ctx!.createOscillator();o.type='sine';o.frequency.value=hz*(i===2?1.001:1);o.connect(ambientAmp!);o.start();ambientVoices.push(o);});
  }catch{/* Autoplay restrictions: retry after the first interaction. */}
}
