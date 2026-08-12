import { useEffect, useRef, useState } from 'react'
import { availableGenres, getPopularMovies, type Movie, type MovieFilters, type MovieSelection } from './tmdb'
import { socket } from './socket'

const fallbackMovies: Movie[] = [
  {
    id: 'movie-157336', title: 'Интерстеллар', year: '2014', rating: '8.7', genres: ['Фантастика', 'Драма'], genreIds: [878, 18],
    synopsis: 'Когда Земля становится непригодной для жизни, команда исследователей отправляется искать новый дом для человечества.',
    image: 'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', accent: '#d29b5e'
  },
  {
    id: 'movie-546554', title: 'Достать ножи', year: '2019', rating: '7.9', genres: ['Детектив', 'Комедия'], genreIds: [9648, 35],
    synopsis: 'Знаменитый детектив расследует загадочную смерть автора криминальных романов в кругу его большой семьи.',
    image: 'https://image.tmdb.org/t/p/w780/pThyQovXQrw2m0s9x82twj48Jq4.jpg', accent: '#d15558'
  },
  {
    id: 'movie-313369', title: 'Ла-Ла Ленд', year: '2016', rating: '8.0', genres: ['Музыка', 'Романтика'], genreIds: [10749, 18],
    synopsis: 'Пианист и начинающая актриса встречаются в Лос-Анджелесе, где мечта постоянно спорит с любовью.',
    image: 'https://image.tmdb.org/t/p/w780/uDO8zWDhfWwoFdKS4fVA4l9B2GG.jpg', accent: '#4e8bd7'
  }
]

/** Shared controls used by both people to describe their desired movie night. */
function FilterControls({ filters, setFilters }: { filters: MovieFilters; setFilters: (filters: MovieFilters) => void }) {
  const toggleGenre = (id: number) => setFilters({ ...filters, genres: filters.genres.includes(id) ? filters.genres.filter(genre => genre !== id) : [...filters.genres, id] })
  return <div className="filters"><div className="filter-title">Подобрать что посмотреть</div><div className="filter-row"><span>Тип</span><div className="filter-options">{([['movie', 'Фильмы'], ['tv', 'Сериалы'], ['both', 'Всё']] as const).map(([value, label]) => <button key={value} className={filters.kind === value ? 'selected' : ''} onClick={() => setFilters({ ...filters, kind: value })}>{label}</button>)}</div></div><div className="filter-row"><span>Страна</span><div className="filter-options">{([['all', 'Все'], ['RU', 'Россия'], ['US', 'США']] as const).map(([value, label]) => <button key={value} className={filters.country === value ? 'selected' : ''} onClick={() => setFilters({ ...filters, country: value })}>{label}</button>)}</div></div><div className="filter-row genre-row"><span>Жанры</span><div className="filter-options">{availableGenres.map(genre => <button key={genre.id} className={filters.genres.includes(genre.id) ? 'selected' : ''} onClick={() => toggleGenre(genre.id)}>{genre.name}</button>)}</div></div></div>
}

/** The room entry screen only creates or joins a room; filters come after both people are present. */
function Home({ onCreate, onJoin }: { onCreate: () => void; onJoin: (code: string) => void }) {
  const [code, setCode] = useState('')
  return <main className="landing">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <nav><div className="brand"><span className="brand-mark">M</span>MovieMatch</div><span className="tag">найдите фильм вместе</span></nav>
    <section className="hero">
      <div className="eyebrow"><span /> Вечер кино без споров</div>
      <h1>Один свайп —<br /><em>общий фильм.</em></h1>
      <p>Выбирайте фильмы вместе с другом. Когда ваши вкусы совпадут — MovieMatch покажет идеальный вариант.</p>
      <div className="start-card">
        <button className="primary" onClick={onCreate}>Создать комнату <b>→</b></button>
        <div className="or"><span />или<span /></div>
        <label className="join"><input value={code} maxLength={6} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="КОД КОМНАТЫ" /><button disabled={code.length < 4} onClick={() => onJoin(code)}>Войти</button></label>
      </div>
      <div className="people"><div className="avatars"><i>А</i><i>М</i><i>К</i></div><span>Уже выбирают кино сегодня</span></div>
    </section>
    <footer>MovieMatch <span>·</span> выбирайте то, что хочется смотреть</footer>
  </main>
}

/** Both people confirm filters separately; the server then produces a fair combined set. */
function Filters({ filters, setFilters, onSubmit }: { filters: MovieFilters; setFilters: (filters: MovieFilters) => void; onSubmit: () => void }) {
  const [submitted, setSubmitted] = useState(false)
  const submit = () => { setSubmitted(true); onSubmit() }
  return <main className="filter-page"><nav><div className="brand"><span className="brand-mark">M</span>MovieMatch</div><span className="tag">общая подборка</span></nav><section className="filter-content"><div className="eyebrow"><span /> Ваши условия</div><h1>Что хочется<br /><em>смотреть сегодня?</em></h1><p>Выберите свои фильтры. Когда второй участник подтвердит выбор, мы объединим ваши предпочтения.</p><FilterControls filters={filters} setFilters={setFilters} /><button className="primary filter-submit" disabled={submitted} onClick={submit}>{submitted ? 'Ждём выбор напарника…' : 'Подтвердить выбор'} <b>→</b></button></section></main>
}

/** Shows the room code until the second participant joins. */
function Room({ code, players, onStart }: { code: string; players: number; onStart: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600) }
  return <main className="room-page"><nav><div className="brand"><span className="brand-mark">M</span>MovieMatch</div></nav>
    <section className="room-card"><div className="room-icon">✦</div><div className="eyebrow"><span /> Комната создана</div><h1>Позови напарника<br />по кино</h1><p>Отправь ему код — и начинайте выбирать фильм вместе.</p>
    <button className="room-code" onClick={copy}><span>{code}</span><small>{copied ? 'Скопировано!' : 'Нажми, чтобы скопировать'}</small></button>
    <div className="waiting"><span className={players === 2 ? 'pulse' : ''} />{players === 2 ? 'Напарник подключился!' : 'Ожидаем второго игрока…'}</div>
    {players === 2 && <button className="demo-link" onClick={onStart}>Настроить общую подборку →</button>}</section></main>
}

/** Lets each person select a small, intentional sample of their taste. */
function Taste({ movies, onSubmit }: { movies: Movie[]; onSubmit: (genreIds: number[]) => void }) {
  const [selected, setSelected] = useState<Movie[]>([])
  const [submitted, setSubmitted] = useState(false)
  const toggle = (movie: Movie) => setSelected(current => {
    if (current.some(item => item.id === movie.id)) return current.filter(item => item.id !== movie.id)
    return current.length === 15 ? current : [...current, movie]
  })
  const submit = () => { setSubmitted(true); onSubmit([...new Set(selected.flatMap(movie => movie.genreIds))]) }
  return <main className="taste-page"><nav><div className="brand"><span className="brand-mark">M</span>MovieMatch</div><span className="tag">ваши предпочтения</span></nav>
    <section className="taste-content"><div className="eyebrow"><span /> Необязательный шаг</div><h1>Что вы любите<br /><em>смотреть?</em></h1><p>Отметь до 15 фильмов, которые тебе нравятся. Этот шаг можно пропустить — тогда подборка будет строиться только по фильтрам комнаты.</p>
    <div className="taste-counter"><b>{selected.length}</b> / 15 выбрано <span>{selected.length ? 'можно продолжать' : 'можно пропустить'}</span></div>
    <div className="taste-grid">{movies.slice(0, 15).map(movie => <button key={movie.id} className={`taste-card ${selected.some(item => item.id === movie.id) ? 'selected' : ''}`} onClick={() => toggle(movie)}><img src={movie.image} alt="" /><span className="taste-check">✓</span><strong>{movie.title}</strong><small>★ {movie.rating}</small></button>)}</div>
    <button className="primary taste-submit" disabled={submitted} onClick={submit}>{submitted ? 'Ждём выбор напарника…' : selected.length ? 'Собрать общую подборку' : 'Пропустить этот шаг'} <b>→</b></button></section></main>
}

/** The shared card deck. A swipe only emits a choice; the server decides whether it is a match. */
function Discover({ movies, code, onSwipe }: { movies: Movie[]; code: string; onSwipe: (movie: Movie, choice: 'like' | 'nope') => void }) {
  const [index, setIndex] = useState(0); const [choice, setChoice] = useState<'like' | 'nope' | null>(null); const [dragX, setDragX] = useState(0)
  const startX = useRef<number | null>(null)
  const movie = movies[index % movies.length]
  const action = (next: 'like' | 'nope') => { if (choice) return; setChoice(next); onSwipe(movie, next); setTimeout(() => { setIndex(v => v + 1); setChoice(null); setDragX(0) }, 350) }
  const dragStart = (event: React.PointerEvent<HTMLDivElement>) => { if (choice) return; startX.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId) }
  const dragMove = (event: React.PointerEvent<HTMLDivElement>) => { if (startX.current !== null) setDragX(Math.max(-150, Math.min(150, event.clientX - startX.current))) }
  const dragEnd = () => { if (startX.current === null) return; const distance = dragX; startX.current = null; if (distance > 85) action('like'); else if (distance < -85) action('nope'); else setDragX(0) }
  return <main className="discover"><header><div className="brand"><span className="brand-mark">M</span>MovieMatch</div><div className="room-pill"><span className="online" />{code}</div><div className="partner"><span>Выборы</span><div className="mini-avatars"><i>А</i><i>М</i></div></div></header>
  <section className="swipe-area"><div className={`movie-card ${choice ?? ''}`} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd} style={{ '--accent': movie.accent, transform: choice ? undefined : `translateX(${dragX}px) rotate(${dragX / 18}deg)` } as React.CSSProperties}><img src={movie.image} alt={movie.title} draggable={false} /><div className="poster-shade" /><div className="choice-label nope-label" style={{ opacity: dragX < -30 ? Math.min(1, Math.abs(dragX) / 90) : undefined }}>НЕТ</div><div className="choice-label like-label" style={{ opacity: dragX > 30 ? Math.min(1, dragX / 90) : undefined }}>ХОЧУ</div><div className="movie-info"><div className="movie-meta"><span>{movie.year}</span><span className="rating">★ {movie.rating}</span></div><h1>{movie.title}</h1><div className="genres">{movie.genres.map(genre => <span key={genre}>{genre}</span>)}</div><p>{movie.synopsis}</p></div></div>
  <p className="hint">Свайпай карточку или используй кнопки</p><div className="controls"><button className="round nope" aria-label="Не нравится" onClick={() => action('nope')}>×</button><button className="round info" aria-label="Информация">i</button><button className="round like" aria-label="Нравится" onClick={() => action('like')}>♥</button></div></section></main>
}

function Match({ movie, onContinue }: { movie: Movie; onContinue: () => void }) { return <main className="match"><div className="confetti">✦　·　✦　·　✦</div><section><div className="match-label">Это мэтч!</div><h1>Ваш вечер<br /><em>определён.</em></h1><div className="match-movie"><img src={movie.image} alt="" /><div><span>{movie.year} · ★ {movie.rating}</span><h2>{movie.title}</h2><p>Вам обоим понравился этот фильм</p></div></div><button className="primary" onClick={onContinue}>Продолжить искать <b>→</b></button></section></main> }

/** Coordinates screens, shared room state, and all Socket.IO events. */
export default function App() {
  const [screen, setScreen] = useState<'home' | 'room' | 'filters' | 'taste' | 'discover' | 'match'>('home')
  const [movies, setMovies] = useState<Movie[]>(fallbackMovies)
  const [matchedMovie, setMatchedMovie] = useState<Movie>(fallbackMovies[0])
  const [code, setCode] = useState('')
  const [players, setPlayers] = useState(1)
  const emptyFilters: MovieFilters = { country: 'all', genres: [], kind: 'both' }
  const [filters, setFilters] = useState<MovieFilters>(emptyFilters)
  const [suggestedGenres, setSuggestedGenres] = useState<number[]>([])
  const [selection, setSelection] = useState<MovieSelection>({ page: 1, seed: 1 })
  // Only the newest request may update the card deck. This prevents an old personal
  // filter request from overwriting the merged room filters after both users confirm.
  const movieRequest = useRef(0)
  const loadMovies = (activeFilters: MovieFilters, activeSelection = selection) => {
    const requestId = ++movieRequest.current
    return getPopularMovies(activeFilters, activeSelection).then(films => {
      if (requestId === movieRequest.current && films.length) setMovies(films)
    })
  }
  useEffect(() => {
    const effectiveFilters = { ...filters, genres: filters.genres.length ? filters.genres : suggestedGenres }
    loadMovies(effectiveFilters, selection).catch(() => undefined)
  }, [filters, selection, suggestedGenres])
  useEffect(() => {
    const handleRoom = ({ players: count }: { players: number }) => setPlayers(count)
    const handleMatch = ({ movieId }: { movieId: string }) => {
      setMatchedMovie(movies.find(movie => movie.id === movieId) || fallbackMovies[0])
      setScreen('match')
    }
    const handlePreferences = ({ genreIds }: { genreIds: number[] }) => {
      const effectiveFilters = { ...filters, genres: filters.genres.length ? filters.genres : genreIds }
      setSuggestedGenres(genreIds)
      loadMovies(effectiveFilters, selection).catch(() => undefined).finally(() => setScreen('discover'))
    }
    const handleFilters = ({ filters: mergedFilters }: { filters: MovieFilters }) => {
      setFilters(mergedFilters)
      setSuggestedGenres([])
      loadMovies(mergedFilters, selection).catch(() => undefined).finally(() => setScreen('taste'))
    }
    socket.on('room-state', handleRoom)
    socket.on('match', handleMatch)
    socket.on('preferences-ready', handlePreferences)
    socket.on('filters-ready', handleFilters)
    return () => { socket.off('room-state', handleRoom); socket.off('match', handleMatch); socket.off('preferences-ready', handlePreferences); socket.off('filters-ready', handleFilters) }
  }, [movies, filters, selection])
  const createRoom = () => socket.emit('create-room', emptyFilters, (result: { code?: string; selection?: MovieSelection; error?: string }) => {
    if (result.error || !result.code) return window.alert(result.error || 'Не удалось создать комнату')
    if (result.selection) setSelection(result.selection)
    setFilters(emptyFilters); setSuggestedGenres([])
    setCode(result.code); setPlayers(1); setScreen('room')
  })
  const joinRoom = (roomCode: string) => socket.emit('join-room', roomCode, (result: { code?: string; players?: number; filters?: MovieFilters; selection?: MovieSelection; error?: string }) => {
    if (result.error || !result.code) return window.alert(result.error || 'Не удалось войти в комнату')
    setCode(result.code); setPlayers(result.players || 2)
    if (result.selection) setSelection(result.selection)
    setFilters(emptyFilters); setSuggestedGenres([])
    setScreen('filters')
  })
  const submitFilters = () => socket.emit('set-room-filters', { roomCode: code, filters })
  const submitTaste = (genreIds: number[]) => socket.emit('set-preferences', { roomCode: code, genreIds })
  const sendSwipe = (movie: Movie, choice: 'like' | 'nope') => socket.emit('swipe', { roomCode: code, movieId: movie.id, choice })
  if (screen === 'room') return <Room code={code} players={players} onStart={() => setScreen('filters')} />
  if (screen === 'filters') return <Filters filters={filters} setFilters={setFilters} onSubmit={submitFilters} />
  if (screen === 'taste') return <Taste movies={movies} onSubmit={submitTaste} />
  if (screen === 'discover') return <Discover movies={movies} code={code} onSwipe={sendSwipe} />
  if (screen === 'match') return <Match movie={matchedMovie} onContinue={() => setScreen('discover')} />
  return <Home onCreate={createRoom} onJoin={joinRoom} />
}
