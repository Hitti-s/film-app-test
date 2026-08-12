import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

type Choice = 'like' | 'nope'
type Filters = { country: 'all' | 'RU' | 'US'; genres: number[]; kind: 'movie' | 'tv' | 'both' }
type Selection = { page: number; seed: number }
type Room = { players: Set<string>; swipes: Map<string, Map<string, Choice>>; preferences: Map<string, number[]>; filters: Filters; selection: Selection }

// HTTP health check and WebSocket server share the same port.
const app = express()
const httpServer = createServer(app)
const allowedOrigins = process.env.CLIENT_ORIGIN?.split(',').filter(Boolean) || '*'
const io = new Server(httpServer, { cors: { origin: allowedOrigins, methods: ['GET', 'POST'] } })
const rooms = new Map<string, Room>()

app.use(cors({ origin: allowedOrigins }))
app.get('/health', (_request, response) => response.json({ status: 'ok' }))

// Generates a short code and avoids collisions with rooms still in memory.
function makeCode() {
  let code = ''
  do code = Math.random().toString(36).slice(2, 8).toUpperCase()
  while (rooms.has(code))
  return code
}

// Keeps both clients informed when someone joins or disconnects.
function broadcastRoom(roomCode: string) {
  const room = rooms.get(roomCode)
  if (room) io.to(roomCode).emit('room-state', { players: room.players.size })
}

io.on('connection', socket => {
  socket.on('create-room', (filters: Filters, reply) => {
    const code = makeCode()
    const safeFilters: Filters = { country: ['all', 'RU', 'US'].includes(filters?.country) ? filters.country : 'all', genres: (filters?.genres || []).filter(id => Number.isInteger(id)).slice(0, 8), kind: ['movie', 'tv', 'both'].includes(filters?.kind) ? filters.kind : 'movie' }
    const selection: Selection = { page: Math.floor(Math.random() * 20) + 1, seed: Math.floor(Math.random() * 2 ** 31) }
    rooms.set(code, { players: new Set([socket.id]), swipes: new Map(), preferences: new Map(), filters: safeFilters, selection })
    socket.join(code)
    socket.data.roomCode = code
    reply({ code, selection })
    broadcastRoom(code)
  })

  socket.on('join-room', (rawCode: string, reply) => {
    const code = rawCode.trim().toUpperCase()
    const room = rooms.get(code)
    if (!room) return reply({ error: 'Комната не найдена. Проверь код.' })
    if (room.players.size >= 2) return reply({ error: 'В комнате уже два человека.' })
    room.players.add(socket.id)
    socket.join(code)
    socket.data.roomCode = code
    reply({ code, players: room.players.size, filters: room.filters, selection: room.selection })
    broadcastRoom(code)
  })

  socket.on('swipe', ({ roomCode, movieId, choice }: { roomCode: string; movieId: string; choice: Choice }) => {
    const room = rooms.get(roomCode)
    if (!room || !room.players.has(socket.id) || !['like', 'nope'].includes(choice)) return
    const movieSwipes = room.swipes.get(movieId) || new Map<string, Choice>()
    movieSwipes.set(socket.id, choice)
    room.swipes.set(movieId, movieSwipes)
    if (room.players.size === 2 && [...room.players].every(id => movieSwipes.get(id) === 'like')) {
      io.to(roomCode).emit('match', { movieId })
      room.swipes.delete(movieId)
    }
  })

  // When both people have chosen favourites, prefer the genres they share.
  socket.on('set-preferences', ({ roomCode, genreIds }: { roomCode: string; genreIds: number[] }) => {
    const room = rooms.get(roomCode)
    if (!room || !room.players.has(socket.id)) return
    const safeGenres = [...new Set((genreIds || []).filter(id => Number.isInteger(id)))].slice(0, 20)
    room.preferences.set(socket.id, safeGenres)
    if (room.preferences.size !== 2) return
    const [first, second] = [...room.preferences.values()]
    const shared = first.filter(id => second.includes(id))
    // If tastes do not overlap, use the combined genres instead of an empty result.
    const recommendation = shared.length ? shared : [...new Set([...first, ...second])].slice(0, 4)
    io.to(roomCode).emit('preferences-ready', { genreIds: recommendation })
  })

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode as string | undefined
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    room.players.delete(socket.id)
    room.preferences.delete(socket.id)
    if (room.players.size === 0) rooms.delete(roomCode)
    else broadcastRoom(roomCode)
  })
})

const port = Number(process.env.PORT || 3001)
httpServer.listen(port, '0.0.0.0', () => console.log(`MovieMatch server listening on ${port}`))
