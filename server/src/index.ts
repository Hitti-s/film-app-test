import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

type Choice = 'like' | 'nope'
const MAX_PLAYERS = 5
type Filters = { country: 'all' | 'RU' | 'US'; genres: number[]; kind: 'movie' | 'tv' | 'both' }
type Selection = { page: number; seed: number }
type Preference = { genreIds: number[]; movieIds: string[] }
type Room = { players: Set<string>; swipes: Map<string, Map<string, Choice>>; preferences: Map<string, Preference>; filters: Filters; filterChoices: Map<string, Filters>; filterSubmissions: Set<string>; selection: Selection }

// HTTP health check and WebSocket server share the same port.
const app = express()
const httpServer = createServer(app)
const allowedOrigins = process.env.CLIENT_ORIGIN?.split(',').filter(Boolean) || '*'
const io = new Server(httpServer, { cors: { origin: allowedOrigins, methods: ['GET', 'POST'] } })
const rooms = new Map<string, Room>()

app.use(cors({ origin: allowedOrigins }))
app.get('/health', (_request, response) => response.json({ status: 'ok' }))

// Proxies public TMDB discovery requests so the API key never reaches a browser.
app.get('/api/discover/:kind', async (request, response) => {
  const kind = request.params.kind
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return response.status(500).json({ error: 'TMDB_API_KEY is not configured' })
  if (kind !== 'movie' && kind !== 'tv') return response.status(400).json({ error: 'Unknown catalog type' })

  const page = Math.max(1, Math.min(500, Number(request.query.page) || 1))
  const params = new URLSearchParams({
    api_key: apiKey,
    language: typeof request.query.language === 'string' ? request.query.language : 'ru-RU',
    page: String(page),
    sort_by: 'popularity.desc',
  })
  if (request.query.with_origin_country === 'RU' || request.query.with_origin_country === 'US') params.set('with_origin_country', request.query.with_origin_country)
  if (typeof request.query.with_genres === 'string' && /^[0-9,]+$/.test(request.query.with_genres)) params.set('with_genres', request.query.with_genres)

  try {
    const tmdbResponse = await fetch(`https://api.themoviedb.org/3/discover/${kind}?${params}`)
    const body = await tmdbResponse.json()
    return response.status(tmdbResponse.status).json(body)
  } catch {
    return response.status(502).json({ error: 'TMDB is unavailable' })
  }
})

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
    rooms.set(code, { players: new Set([socket.id]), swipes: new Map(), preferences: new Map(), filterChoices: new Map([[socket.id, safeFilters]]), filterSubmissions: new Set(), filters: safeFilters, selection })
    socket.join(code)
    socket.data.roomCode = code
    reply({ code, selection })
    broadcastRoom(code)
  })

  socket.on('join-room', (rawCode: string, reply) => {
    const code = rawCode.trim().toUpperCase()
    const room = rooms.get(code)
    if (!room) return reply({ error: 'Комната не найдена. Проверь код.' })
    if (room.players.size >= MAX_PLAYERS) return reply({ error: 'В комнате уже максимальное число участников — 5.' })
    room.players.add(socket.id)
    socket.join(code)
    socket.data.roomCode = code
    reply({ code, players: room.players.size, filters: room.filters, selection: room.selection })
    broadcastRoom(code)
  })

  // Each player confirms their own filters. No creator preference receives special priority.
  socket.on('set-room-filters', ({ roomCode, filters }: { roomCode: string; filters: Filters }) => {
    const room = rooms.get(roomCode)
    if (!room || !room.players.has(socket.id)) return
    const safeFilters: Filters = { country: ['all', 'RU', 'US'].includes(filters?.country) ? filters.country : 'all', genres: (filters?.genres || []).filter(id => Number.isInteger(id)).slice(0, 8), kind: ['movie', 'tv', 'both'].includes(filters?.kind) ? filters.kind : 'movie' }
    room.filterChoices.set(socket.id, safeFilters)
    room.filterSubmissions.add(socket.id)
    if (room.filterSubmissions.size !== room.players.size) return

    const choices = [...room.filterChoices.values()]
    const [first, ...others] = choices
    const sharedGenres = first.genres.filter(id => others.every(choice => choice.genres.includes(id)))
    const merged: Filters = {
      kind: choices.every(choice => choice.kind === first.kind) ? first.kind : 'both',
      country: choices.every(choice => choice.country === first.country) ? first.country : 'all',
      // A blank genre list means no restriction; otherwise use only genres both selected.
      genres: choices.some(choice => choice.genres.length === 0) ? [] : sharedGenres,
    }
    room.filters = merged
    io.to(roomCode).emit('filters-ready', { filters: merged })
  })

  socket.on('swipe', ({ roomCode, movieId, choice }: { roomCode: string; movieId: string; choice: Choice }) => {
    const room = rooms.get(roomCode)
    if (!room || !room.players.has(socket.id) || !['like', 'nope'].includes(choice)) return
    const movieSwipes = room.swipes.get(movieId) || new Map<string, Choice>()
    movieSwipes.set(socket.id, choice)
    room.swipes.set(movieId, movieSwipes)
    if (room.players.size >= 2 && [...room.players].every(id => movieSwipes.get(id) === 'like')) {
      io.to(roomCode).emit('match', { movieId })
      room.swipes.delete(movieId)
    }
  })

  // When both people have chosen favourites, find instant matches and shared genres.
  socket.on('set-preferences', ({ roomCode, genreIds, movieIds }: { roomCode: string; genreIds: number[]; movieIds: string[] }) => {
    const room = rooms.get(roomCode)
    if (!room || !room.players.has(socket.id)) return
    const safeGenres = [...new Set((genreIds || []).filter(id => Number.isInteger(id)))].slice(0, 20)
    const safeMovieIds = [...new Set((movieIds || []).filter(id => typeof id === 'string' && /^(movie|tv)-\d+$/.test(id)))].slice(0, 15)
    room.preferences.set(socket.id, { genreIds: safeGenres, movieIds: safeMovieIds })
    if (room.preferences.size !== room.players.size) return
    const choices = [...room.preferences.values()]
    const [first, ...others] = choices
    const shared = first.genreIds.filter(id => others.every(choice => choice.genreIds.includes(id)))
    // If tastes do not overlap, use the combined genres instead of an empty result.
    const recommendation = shared.length ? shared : [...new Set(choices.flatMap(choice => choice.genreIds))].slice(0, 4)
    const matchedMovieIds = first.movieIds.filter(id => others.every(choice => choice.movieIds.includes(id)))
    const selectedMovieIds = [...new Set(choices.flatMap(choice => choice.movieIds))]
    io.to(roomCode).emit('preferences-ready', { genreIds: recommendation, selectedMovieIds, matchedMovieIds })
  })

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode as string | undefined
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    room.players.delete(socket.id)
    room.preferences.delete(socket.id)
    room.filterChoices.delete(socket.id)
    room.filterSubmissions.delete(socket.id)
    if (room.players.size === 0) rooms.delete(roomCode)
    else broadcastRoom(roomCode)
  })
})

const port = Number(process.env.PORT || 3001)
httpServer.listen(port, '0.0.0.0', () => console.log(`MovieMatch server listening on ${port}`))
