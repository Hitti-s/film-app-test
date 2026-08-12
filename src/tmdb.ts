export type TmdbMovie = {
  id: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  vote_average: number
  genre_ids: number[]
  overview: string
  poster_path: string | null
  backdrop_path: string | null
}

// TMDB returns numeric genre IDs; the UI needs short Russian labels.
const genreNames: Record<number, string> = {
  28: 'Боевик', 12: 'Приключения', 16: 'Мультфильм', 35: 'Комедия', 80: 'Криминал',
  18: 'Драма', 14: 'Фэнтези', 27: 'Ужасы', 53: 'Триллер', 878: 'Фантастика',
  10749: 'Романтика', 9648: 'Детектив', 99: 'Документальный', 10751: 'Семейный',
}

export type Movie = {
  id: string
  title: string
  year: string
  rating: string
  genres: string[]
  /** Original TMDB genre identifiers, used to compare two users' taste. */
  genreIds: number[]
  synopsis: string
  image: string
  accent: string
}

export type MovieFilters = { country: 'all' | 'RU' | 'US'; genres: number[]; kind: 'movie' | 'tv' | 'both' }
export type MovieSelection = { page: number; seed: number }

export const availableGenres = [
  { id: 28, name: 'Боевик' }, { id: 35, name: 'Комедия' }, { id: 18, name: 'Драма' },
  { id: 14, name: 'Фэнтези' }, { id: 27, name: 'Ужасы' }, { id: 10749, name: 'Романтика' },
  { id: 878, name: 'Фантастика' }, { id: 53, name: 'Триллер' },
]

// A seeded shuffle gives both people the same order without storing a film list on the server.
function shuffle<T>(items: T[], seed: number): T[] {
  const result = [...items]
  let state = seed || 1
  const random = () => {
    state |= 0; state = state + 0x6d2b79f5 | 0
    let value = Math.imul(state ^ state >>> 15, 1 | state)
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

export async function getPopularMovies(filters: MovieFilters, selection: MovieSelection = { page: 1, seed: 1 }): Promise<Movie[]> {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY
  if (!apiKey) throw new Error('TMDB API key is not configured')

  // In mixed mode query both TMDB catalogs, then shuffle their combined result.
  const kinds: Array<'movie' | 'tv'> = filters.kind === 'both' ? ['movie', 'tv'] : [filters.kind]
  const results = await Promise.all(kinds.map(async kind => {
    const params = new URLSearchParams({ api_key: apiKey, language: 'ru-RU', page: String(selection.page), sort_by: 'popularity.desc' })
    if (filters.country !== 'all') params.set('with_origin_country', filters.country)
    if (filters.genres.length) params.set('with_genres', filters.genres.join(','))
    const response = await fetch(`https://api.themoviedb.org/3/discover/${kind}?${params}`)
    if (!response.ok) throw new Error('TMDB request failed')
    const data = await response.json() as { results: TmdbMovie[] }
    return data.results.filter(movie => movie.poster_path || movie.backdrop_path).map((movie, index) => ({
      id: `${kind}-${movie.id}`,
      title: movie.title || movie.name || 'Без названия',
      year: (movie.release_date || movie.first_air_date)?.slice(0, 4) || '—',
      rating: movie.vote_average.toFixed(1),
      genres: movie.genre_ids.map(id => genreNames[id]).filter(Boolean).slice(0, 2),
      genreIds: movie.genre_ids,
      synopsis: movie.overview || 'Описание пока не добавлено.',
      image: `https://image.tmdb.org/t/p/w780${movie.backdrop_path || movie.poster_path}`,
      accent: ['#d29b5e', '#d15558', '#4e8bd7', '#8d66ca'][index % 4],
    }))
  }))
  return shuffle(results.flat(), selection.seed)
}
