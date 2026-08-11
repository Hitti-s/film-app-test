import { useMemo, useState } from 'react'

type Movie = {
  title: string
  year: string
  rating: string
  genres: string[]
  synopsis: string
  image: string
  accent: string
}

const movies: Movie[] = [
  {
    title: 'Интерстеллар', year: '2014', rating: '8.7', genres: ['Фантастика', 'Драма'],
    synopsis: 'Когда Земля становится непригодной для жизни, команда исследователей отправляется искать новый дом для человечества.',
    image: 'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', accent: '#d29b5e'
  },
  {
    title: 'Достать ножи', year: '2019', rating: '7.9', genres: ['Детектив', 'Комедия'],
    synopsis: 'Знаменитый детектив расследует загадочную смерть автора криминальных романов в кругу его большой семьи.',
    image: 'https://image.tmdb.org/t/p/w780/pThyQovXQrw2m0s9x82twj48Jq4.jpg', accent: '#d15558'
  },
  {
    title: 'Ла-Ла Ленд', year: '2016', rating: '8.0', genres: ['Музыка', 'Романтика'],
    synopsis: 'Пианист и начинающая актриса встречаются в Лос-Анджелесе, где мечта постоянно спорит с любовью.',
    image: 'https://image.tmdb.org/t/p/w780/uDO8zWDhfWwoFdKS4fVA4l9B2GG.jpg', accent: '#4e8bd7'
  }
]

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

function Room({ code, onStart }: { code: string; onStart: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600) }
  return <main className="room-page"><nav><div className="brand"><span className="brand-mark">M</span>MovieMatch</div></nav>
    <section className="room-card"><div className="room-icon">✦</div><div className="eyebrow"><span /> Комната создана</div><h1>Позови напарника<br />по кино</h1><p>Отправь ему код — и начинайте выбирать фильм вместе.</p>
    <button className="room-code" onClick={copy}><span>{code}</span><small>{copied ? 'Скопировано!' : 'Нажми, чтобы скопировать'}</small></button>
    <div className="waiting"><span className="pulse" />Ожидаем второго игрока…</div>
    <button className="demo-link" onClick={onStart}>Продолжить в демо-режиме →</button></section></main>
}

function Discover({ onMatch }: { onMatch: (movie: Movie) => void }) {
  const [index, setIndex] = useState(0); const [choice, setChoice] = useState<'like' | 'nope' | null>(null)
  const movie = movies[index % movies.length]
  const action = (next: 'like' | 'nope') => { setChoice(next); setTimeout(() => { if (next === 'like' && index === 0) onMatch(movie); else { setIndex(v => v + 1); setChoice(null) } }, 350) }
  return <main className="discover"><header><div className="brand"><span className="brand-mark">M</span>MovieMatch</div><div className="room-pill"><span className="online" />ABF92K</div><div className="partner"><span>Выборы</span><div className="mini-avatars"><i>А</i><i>М</i></div></div></header>
  <section className="swipe-area"><div className={`movie-card ${choice ?? ''}`} style={{ '--accent': movie.accent } as React.CSSProperties}><img src={movie.image} alt={movie.title} /><div className="poster-shade" /><div className="choice-label nope-label">НЕТ</div><div className="choice-label like-label">ХОЧУ</div><div className="movie-info"><div className="movie-meta"><span>{movie.year}</span><span className="rating">★ {movie.rating}</span></div><h1>{movie.title}</h1><div className="genres">{movie.genres.map(genre => <span key={genre}>{genre}</span>)}</div><p>{movie.synopsis}</p></div></div>
  <p className="hint">Свайпай карточку или используй кнопки</p><div className="controls"><button className="round nope" aria-label="Не нравится" onClick={() => action('nope')}>×</button><button className="round info" aria-label="Информация">i</button><button className="round like" aria-label="Нравится" onClick={() => action('like')}>♥</button></div></section></main>
}

function Match({ movie, onContinue }: { movie: Movie; onContinue: () => void }) { return <main className="match"><div className="confetti">✦　·　✦　·　✦</div><section><div className="match-label">Это мэтч!</div><h1>Ваш вечер<br /><em>определён.</em></h1><div className="match-movie"><img src={movie.image} alt="" /><div><span>{movie.year} · ★ {movie.rating}</span><h2>{movie.title}</h2><p>Вам обоим понравился этот фильм</p></div></div><button className="primary" onClick={onContinue}>Продолжить искать <b>→</b></button></section></main> }

export default function App() {
  const [screen, setScreen] = useState<'home' | 'room' | 'discover' | 'match'>('home')
  const code = useMemo(() => Math.random().toString(36).slice(2, 8).toUpperCase(), [])
  if (screen === 'room') return <Room code={code} onStart={() => setScreen('discover')} />
  if (screen === 'discover') return <Discover onMatch={() => setScreen('match')} />
  if (screen === 'match') return <Match movie={movies[0]} onContinue={() => setScreen('discover')} />
  return <Home onCreate={() => setScreen('room')} onJoin={() => setScreen('discover')} />
}
