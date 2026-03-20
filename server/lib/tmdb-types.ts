export interface TMDBSearchResult {
  id: number;
  media_type?: 'tv' | 'movie';
  name?: string;
  title?: string;
  original_name?: string;
  original_title?: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  first_air_date?: string;
  release_date?: string;
  vote_average: number;
}

export interface TMDBShowDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  first_air_date: string;
  vote_average: number;
  status?: string;
  genres: { id: number; name: string }[];
  number_of_seasons: number;
}

export interface TMDBMovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date: string;
  vote_average: number;
  runtime: number;
  tagline?: string;
  genres: { id: number; name: string }[];
}

export interface TMDBEpisodeDetails {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  overview: string;
  air_date: string;
  vote_average: number;
  still_path?: string;
}

export interface TMDBSeasonDetails {
  id: number;
  name: string;
  season_number: number;
  overview: string;
  poster_path?: string;
  air_date?: string;
  episodes?: TMDBEpisodeDetails[];
}

export interface TMDBFindResponse {
  movie_results?: TMDBSearchResult[];
  tv_results?: TMDBSearchResult[];
}
