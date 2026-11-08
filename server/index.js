const http = require("node:http");
const crypto = require("node:crypto");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
const socketPlayers = new Map();
const missions = [
  "Make someone laugh without speaking",
  "Get another player to say your name",
  "Convince the group to take a selfie",
  "Give someone a sincere compliment",
  "Get two players to high-five",
  "Start a group chant and get two people to join"
];
const dares = [
  "Do your best celebrity impression",
  "Speak in an accent for one round",
  "Let the group choose your profile pose",
  "Tell the funniest thing that happened to you",
  "Do a dramatic movie monologue",
  "Dance for 15 seconds"
];

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, service: "innercircle" }));
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("The Inner Circle multiplayer server is running.");
});
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

function snapshot(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: [...room.players.values()]
      .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
      .map(({ id, name, score, connected }) => ({ id, name, score, connected }))
  };
}
function broadcast(room) {
  io.to(room.code).emit("room:update", snapshot(room));
}
function makeCode() {
  let code;
  do { code = crypto.randomBytes(3).toString("hex").toUpperCase(); }
  while (rooms.has(code));
  return code;
}
function fail(socket, message, ack) {
  socket.emit("room:error", message);
  if (typeof ack === "function") ack({ ok: false, error: message });
}
function attachPlayer(socket, room, name, ack, isHost = false) {
  const id = crypto.randomUUID();
  const player = { id, name, score: 0, connected: true, joinedAt: Date.now(), activeMission: null };
  room.players.set(id, player);
  socket.join(room.code);
  socketPlayers.set(socket.id, { id, code: room.code });
  socket.data.playerId = id;
  socket.data.roomCode = room.code;
  if (isHost) room.hostId = id;
  broadcast(room);
  if (typeof ack === "function") ack({ ok: true, code: room.code, playerId: id });
}
io.on("connection", socket => {
  socket.on("room:create", ({ name } = {}, ack) => {
    const playerName = String(name || "").trim().slice(0, 18);
    if (!playerName) return fail(socket, "Enter a player name.", ack);
    const code = makeCode();
    const room = { code, hostId: null, status: "waiting", players: new Map(), createdAt: Date.now() };
    rooms.set(code, room);
    attachPlayer(socket, room, playerName, ack, true);
  });
  socket.on("room:join", ({ name, code } = {}, ack) => {
    const playerName = String(name || "").trim().slice(0, 18);
    const roomCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!playerName) return fail(socket, "Enter a player name.", ack);
    if (!room) return fail(socket, "That room code wasn't found. Ask the host to create a new room.", ack);
    attachPlayer(socket, room, playerName, ack);
  });
  socket.on("game:mission-request", () => {
    const info = socketPlayers.get(socket.id);
    const room = info && rooms.get(info.code);
    const player = room && room.players.get(info.id);
    if (!player) return;
    if (!player.activeMission) player.activeMission = missions[crypto.randomInt(missions.length)];
    socket.emit("game:mission", player.activeMission);
  });
  socket.on("game:mission-complete", () => {
    const info = socketPlayers.get(socket.id);
    const room = info && rooms.get(info.code);
    const player = room && room.players.get(info.id);
    if (!player || !player.activeMission) return;
    player.activeMission = null;
    player.score += 10;
    broadcast(room);
    socket.emit("game:mission-completed", { points: 10 });
  });
  socket.on("game:dare-spin", () => {
    const info = socketPlayers.get(socket.id);
    const room = info && rooms.get(info.code);
    if (!room || !info) return;
    const dare = dares[crypto.randomInt(dares.length)];
    io.to(room.code).emit("game:dare", { playerId: info.id, dare });
  });
  socket.on("room:leave", () => leaveSocket(socket));
  socket.on("disconnect", () => leaveSocket(socket));
});
function leaveSocket(socket) {
  const info = socketPlayers.get(socket.id);
  if (!info) return;
  socketPlayers.delete(socket.id);
  const room = rooms.get(info.code);
  if (room) {
    room.players.delete(info.id);
    if (room.hostId === info.id) {
      room.hostId = room.players.keys().next().value || null;
    }
    if (room.players.size === 0) {
      rooms.delete(info.code);
    } else {
      broadcast(room);
    }
  }
  socket.leave(info.code);
}
server.listen(PORT, "0.0.0.0", () => console.log("Inner Circle server listening on " + PORT));
