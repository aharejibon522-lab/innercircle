const http = require("node:http");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");
const { Server } = require("socket.io");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 3000);
const dbPath = process.env.DB_PATH || path.join(__dirname,"innercircle.sqlite");
fs.mkdirSync(path.dirname(dbPath),{recursive:true});
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, room_code TEXT NOT NULL, name TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, joined_at TEXT NOT NULL, FOREIGN KEY(room_code) REFERENCES rooms(code) ON DELETE CASCADE);
`);
const getRoom = db.prepare("SELECT * FROM rooms WHERE code=?");
const getPlayers = db.prepare("SELECT id,name,score FROM players WHERE room_code=? ORDER BY score DESC, joined_at ASC");
const sockets = new Map();
const socketPlayer = new Map();
const missions = ["Make someone laugh without speaking","Get another player to say your name","Convince the group to take a selfie","Give someone a sincere compliment","Get two players to high-five","Start a group chant and get two people to join"];
const server = http.createServer((req,res)=>{if(req.url==="/health"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({ok:true,service:"innercircle"}));}res.writeHead(200,{"content-type":"text/plain"});res.end("The Inner Circle multiplayer server is running.");});
const io = new Server(server,{cors:{origin:"*",methods:["GET","POST"]}});
function roomSnapshot(code){
 const room=getRoom.get(code); if(!room)return null;
 const players=getPlayers.all(code).map(p=>({...p,connected:sockets.has(p.id)}));
 return {code:room.code,hostId:room.host_id,status:room.status,players};
}
function broadcast(code){const snapshot=roomSnapshot(code);if(snapshot)io.to(code).emit("room:update",snapshot);}
function makeCode(){let code;do{code=crypto.randomBytes(3).toString("hex").toUpperCase();}while(getRoom.get(code));return code;}
function fail(socket,message,ack){socket.emit("room:error",message);if(typeof ack==="function")ack({ok:false,error:message});}
io.on("connection",socket=>{
 socket.on("room:create",({name}={},ack)=>{
  const playerName=String(name||"").trim().slice(0,18);if(!playerName)return fail(socket,"Enter a player name.",ack);
  const code=makeCode(),id=crypto.randomUUID(),now=new Date().toISOString();
  db.prepare("INSERT INTO rooms(code,host_id,created_at) VALUES(?,?,?)").run(code,id,now);
  db.prepare("INSERT INTO players(id,room_code,name,joined_at) VALUES(?,?,?,?)").run(id,code,playerName,now);
  socket.join(code);sockets.set(id,socket.id);socketPlayer.set(socket.id,{id,code});socket.data.playerId=id;socket.data.roomCode=code;
  broadcast(code);if(ack)ack({ok:true,code,playerId:id});
 });
 socket.on("room:join",({name,code}={},ack)=>{
  const playerName=String(name||"").trim().slice(0,18),roomCode=String(code||"").trim().toUpperCase(),room=getRoom.get(roomCode);
  if(!playerName)return fail(socket,"Enter a player name.",ack);if(!room)return fail(socket,"That room code wasn't found.",ack);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  db.prepare("INSERT INTO players(id,room_code,name,joined_at) VALUES(?,?,?,?)").run(id,roomCode,playerName,now);
  socket.join(roomCode);sockets.set(id,socket.id);socketPlayer.set(socket.id,{id,code:roomCode});socket.data.playerId=id;socket.data.roomCode=roomCode;
  broadcast(roomCode);if(ack)ack({ok:true,code:roomCode,playerId:id});
 });
 socket.on("game:mission-request",()=>{
  if(!socket.data.roomCode)return;
  const mission=missions[crypto.randomInt(missions.length)];
  socket.emit("game:mission",mission);
 });
 socket.on("game:mission-complete",({mission}={})=>{
  const id=socket.data.playerId,code=socket.data.roomCode;if(!id||!code)return;
  db.prepare("UPDATE players SET score=score+10 WHERE id=? AND room_code=?").run(id,code);
  broadcast(code);
 });
 socket.on("room:leave",()=>leaveSocket(socket));
 socket.on("disconnect",()=>leaveSocket(socket));
});
function leaveSocket(socket){
 const info=socketPlayer.get(socket.id);if(!info)return;
 sockets.delete(info.id);socketPlayer.delete(socket.id);socket.leave(info.code);
 // Room and player records remain so a room survives if its creator disconnects.
 broadcast(info.code);socket.data.playerId=null;socket.data.roomCode=null;
}
server.listen(PORT,"0.0.0.0",()=>console.log("Inner Circle server listening on "+PORT));
