/** Authoritative, two-player Socket.IO room server. No client-supplied state is trusted. */
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { applyAction, initialGame, legalMoves, type Action, type GameState } from '@wrongway/rules';

const ORIGIN = process.env.CLIENT_ORIGIN?.split(',') ?? ['http://localhost:5173'];
const app = express(); app.use(cors({ origin: ORIGIN }));
app.get('/health', (_, res) => res.json({ ok: true, game: 'Wrong Way', rooms: rooms.size }));
const http = createServer(app);
const io = new Server(http, { cors: { origin: ORIGIN }, transports: ['websocket', 'polling'] });
const PORT = Number(process.env.PORT || 3001);
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_SIZE = 6;
const IDLE_MS = 30 * 60_000;
const RECONNECT_MS = 60_000;
const DISCONNECT_GRACE = 60_000;

type Seat = { token: string; name: string; socketId: string | null; ready: boolean; disconnectedAt: number | null };
type Status = 'lobby' | 'countdown' | 'playing' | 'finished';
type Room = { code: string; seats: [Seat, Seat?]; status: Status; hostFirst: boolean; timer: 0|30|60; deadline: number | null; state: GameState | null; created: number; touched: number; countdown?: NodeJS.Timeout; tick?: NodeJS.Timeout; grace?: NodeJS.Timeout; rematch: Set<number> };
const rooms = new Map<string, Room>();
const lastCall = new Map<string, { t: number; count: number }>();
const nameSchema = z.string().trim().max(28).optional();
const codeSchema = z.string().trim().length(6).regex(/^[A-HJ-KM-NP-Z2-9]+$/);
const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), to: z.object({ r: z.number().int().min(0).max(8), c: z.number().int().min(0).max(8) }) }),
  z.object({ type: z.literal('wall'), wall: z.object({ r: z.number().int().min(0).max(7), c: z.number().int().min(0).max(7), orientation: z.enum(['h','v']) }) })
]);
function nickname(value: unknown, fallback: string) {
  const s = nameSchema.safeParse(value);
  const name = s.success ? (s.data ?? '').replace(/[<>\\\u0000-\u001F]/g, '').replace(/\s+/g, ' ').trim() : '';
  return (name || fallback).slice(0, 20);
}
function code() { let c = ''; for (const b of randomBytes(CODE_SIZE)) c += ROOM_ALPHABET[b % ROOM_ALPHABET.length]; return c; }
function token() { return randomBytes(24).toString('hex'); }
function throttle(socket: Socket, limit = 12, seconds = 5) {
  const key = socket.handshake.address;
  const now = Date.now(); const a = lastCall.get(key);
  if (!a || now - a.t > seconds*1000) { lastCall.set(key, {t:now,count:1}); return false; }
  a.count++; return a.count > limit;
}
function ack(cb: unknown, payload: unknown) { if (typeof cb === 'function') (cb as (v:unknown)=>void)(payload); }
function findSeat(room: Room, socket: Socket) { return room.seats.findIndex(s=>s?.socketId===socket.id); }
function view(room: Room) { return { code: room.code, status: room.status, seats: room.seats.map(s=>s && ({name:s.name,ready:s.ready,connected:!!s.socketId})), timer: room.timer, hostFirst:room.hostFirst, deadline:room.deadline, state:room.state }; }
function broadcast(room: Room) { room.touched=Date.now(); io.to(room.code).emit('state_update', view(room)); }
function end(room: Room, winnerId: string | null, reason: string) {
  if(room.status==='finished') return;
  room.status='finished'; room.deadline=null;
  if(room.state) room.state = { ...room.state, winner: winnerId };
  clearInterval(room.tick); clearTimeout(room.grace); io.to(room.code).emit('game_over', { winnerId, reason }); broadcast(room);
}
function setClock(room: Room) {
  room.deadline = room.timer ? Date.now() + room.timer*1000 : null;
  if (room.state?.winner) { end(room, room.state.winner, 'goal'); return; }
  broadcast(room);
}
function autoMove(room: Room) {
  if(room.status!=='playing'||!room.state) return;
  const candidates = legalMoves(room.state); if(!candidates.length) return;
  room.state = applyAction(room.state, { type:'move', to: candidates[Math.floor(Math.random()*candidates.length)] });
  io.to(room.code).emit('notice', 'Turn timer expired. A legal move was played.'); setClock(room);
}
function start(room: Room) {
  if (room.status !== 'lobby' || room.seats.length!==2 || !room.seats.every(s=>s?.ready)) return;
  room.status = 'countdown'; broadcast(room);
  room.countdown = setTimeout(() => {
    if (room.status!=='countdown') return;
    room.state=initialGame([room.seats[0]!.name,room.seats[1]!.name]);
    if(!room.hostFirst) room.state.turn=1;
    room.status='playing'; setClock(room);
    clearInterval(room.tick);
    room.tick=setInterval(()=>{if(room.deadline && Date.now()>=room.deadline) autoMove(room);},250);
  },3200);
}
function expireDisconnected(room: Room, seatIndex: number) {
  clearTimeout(room.grace);
  room.grace=setTimeout(()=>{
    const seat=room.seats[seatIndex];
    if(seat && !seat.socketId && room.status==='playing') end(room,room.state?.players[1-seatIndex]?.id ?? null,'disconnect');
  },DISCONNECT_GRACE);
}
function locate(socket:Socket, data:unknown) {
  const code = typeof data === 'object' && data && 'code' in data ? (data as {code?:unknown}).code : undefined;
  if(typeof code!=='string') return null;
  const room = rooms.get(code.toUpperCase());
  if(!room || findSeat(room,socket)<0) return null;
  return room;
}
io.on('connection', socket=>{
  socket.on('create_room', (input, cb)=>{
    if(throttle(socket,4,30)) return ack(cb,{ok:false,error:'Too many requests. Try again shortly.'});
    const data = z.object({name:z.unknown().optional(),timer:z.union([z.literal(0),z.literal(30),z.literal(60)]).default(0),hostFirst:z.boolean().default(true)}).safeParse(input);
    if(!data.success) return ack(cb,{ok:false,error:'Invalid room settings'});
    let c=code(); while(rooms.has(c)) c=code();
    const seat:Seat={token:token(),name:nickname(data.data.name,'Player 1'),socketId:socket.id,ready:false,disconnectedAt:null};
    const room:Room={code:c,seats:[seat],status:'lobby',timer:data.data.timer,hostFirst:data.data.hostFirst,deadline:null,state:null,created:Date.now(),touched:Date.now(),rematch:new Set()};
    rooms.set(c,room); socket.join(c); ack(cb,{ok:true,code:c,seat:0,token:seat.token,room:view(room)}); broadcast(room);
  });
  socket.on('join_room', (input, cb)=>{
    if(throttle(socket,12,30)) return ack(cb,{ok:false,error:'Too many attempts'});
    const data=z.object({code:z.string().trim().toUpperCase(),name:z.unknown().optional(),token:z.string().optional()}).safeParse(input);
    if(!data.success || !codeSchema.safeParse(data.data.code).success) return ack(cb,{ok:false,error:'Enter a valid 6-character code'});
    const room=rooms.get(data.data.code);
    if(!room) return ack(cb,{ok:false,error:'Room not found'});
    let seatIndex=room.seats.findIndex(s=>s?.token===data.data.token);
    if(seatIndex<0){
      if(room.seats.length>=2 || room.status!=='lobby') return ack(cb,{ok:false,error:'Room is full'});
      seatIndex=1;room.seats.push({token:token(),name:nickname(data.data.name,'Player 2'),socketId:null,ready:false,disconnectedAt:null});
    }
    const seat=room.seats[seatIndex]!;
    if(seat.socketId && seat.socketId!==socket.id) io.sockets.sockets.get(seat.socketId)?.disconnect(true);
    seat.socketId=socket.id;seat.disconnectedAt=null;socket.join(room.code);clearTimeout(room.grace);
    ack(cb,{ok:true,code:room.code,seat:seatIndex,token:seat.token,room:view(room)});broadcast(room);
  });
  socket.on('leave_room',(input,cb)=>{
    const room=locate(socket,input);if(!room)return ack(cb,{ok:false});const idx=findSeat(room,socket);
    if(room.status==='playing')end(room,room.state?.players[1-idx]?.id??null,'resign');
    socket.leave(room.code);
    if(room.status==='lobby'&&idx===1)room.seats.pop();
    else if(room.status==='lobby'&&idx===0){rooms.delete(room.code);io.to(room.code).emit('notice','The host closed this room.');}
    else {room.seats[idx]!.socketId=null;room.seats[idx]!.disconnectedAt=Date.now();}
    if(rooms.has(room.code))broadcast(room);ack(cb,{ok:true});
  });
  socket.on('ready', (input,cb)=>{
    const room=locate(socket,input);if(!room || room.status!=='lobby') return ack(cb,{ok:false,error:'Not in lobby'});
    const idx=findSeat(room,socket);room.seats[idx]!.ready=!!(input as {ready?:boolean}).ready;
    broadcast(room);start(room);ack(cb,{ok:true});
  });
  socket.on('play_action', (input,cb)=>{
    if(throttle(socket,15,3)) return ack(cb,{ok:false,error:'Slow down'});
    const room=locate(socket,input);if(!room||room.status!=='playing'||!room.state) return ack(cb,{ok:false,error:'Game is not active'});
    const index=findSeat(room,socket);if(room.state.turn!==index) return ack(cb,{ok:false,error:'Not your turn'});
    const parsed=actionSchema.safeParse((input as {action?:unknown}).action);
    if(!parsed.success) return ack(cb,{ok:false,error:'Invalid move'});
    try{room.state=applyAction(room.state,parsed.data as Action);setClock(room);ack(cb,{ok:true});}
    catch(e){ack(cb,{ok:false,error:(e as Error).message});}
  });
  socket.on('resign',(input,cb)=>{const room=locate(socket,input);if(!room||room.status!=='playing') return ack(cb,{ok:false});end(room,room.state?.players[1-findSeat(room,socket)]?.id ?? null,'resign');ack(cb,{ok:true});});
  socket.on('offer_draw',(input,cb)=>{const room=locate(socket,input);if(!room||room.status!=='playing')return ack(cb,{ok:false});io.to(room.code).emit('draw_offer',{from:findSeat(room,socket)});ack(cb,{ok:true});});
  socket.on('accept_draw',(input,cb)=>{const room=locate(socket,input);if(!room||room.status!=='playing')return ack(cb,{ok:false});end(room,null,'draw');ack(cb,{ok:true});});
  socket.on('rematch',(input,cb)=>{const room=locate(socket,input);if(!room||room.status!=='finished')return ack(cb,{ok:false});room.rematch.add(findSeat(room,socket));if(room.rematch.size===2){room.rematch.clear();room.hostFirst=!room.hostFirst;room.status='lobby';room.state=null;room.seats.forEach(s=>{if(s)s.ready=false;});broadcast(room);}else io.to(room.code).emit('notice','Rematch requested. Waiting for your friend.');ack(cb,{ok:true});});
  socket.on('reaction',(input)=>{if(throttle(socket,4,3))return;const room=locate(socket,input);const e=(input as {emoji?:unknown})?.emoji;if(room&&['🔥','👏','😮','😎','❤️','😂'].includes(String(e)))socket.to(room.code).emit('reaction',{emoji:e,from:findSeat(room,socket)});});
  socket.on('disconnect',()=>{
    for(const room of rooms.values()){
      const idx=findSeat(room,socket);if(idx<0)continue;
      const seat=room.seats[idx]!;seat.socketId=null;seat.disconnectedAt=Date.now();room.touched=Date.now();
      if(room.status==='playing')expireDisconnected(room,idx);
      if(room.status==='countdown'){clearTimeout(room.countdown);room.status='lobby';room.seats.forEach(s=>{if(s)s.ready=false;});}
      broadcast(room);
    }
  });
});
setInterval(()=>{
  const now=Date.now();
  for(const [code,room] of rooms) if(now-room.touched>IDLE_MS || (room.status==='finished' && now-room.touched>10*60_000)) {clearInterval(room.tick);clearTimeout(room.countdown);clearTimeout(room.grace);rooms.delete(code);}
  for(const [key,val] of lastCall) if(now-val.t>60_000)lastCall.delete(key);
},60_000).unref();
http.listen(PORT,'0.0.0.0',()=>console.log(`Wrong Way server listening on ${PORT}`));
