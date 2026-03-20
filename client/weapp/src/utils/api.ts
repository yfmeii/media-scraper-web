import { createClientApi } from '@media-scraper/shared/client-api'
import { get, post } from './request'

export type {
  DirectoryGroup,
  MatchResult,
  MediaFile,
  MovieInfo,
  PathRecognizeResult,
  PreviewAction,
  PreviewItem,
  PreviewPlan,
  ProcessMovieParams,
  ProcessTVParams,
  ScrapeResult,
  SearchResult,
  ShowInfo,
  Stats,
  TaskItem,
  TaskStats,
} from '@media-scraper/shared/types'

const api = createClientApi({ get, post })

export const {
  fetchStats,
  fetchTVShows,
  fetchMovies,
  fetchInbox,
  fetchInboxByDirectory,
  searchTMDB,
  searchTMDBByImdb,
  autoMatch,
  recognizePath,
  processTV,
  processMovie,
  previewPlan,
  refreshMetadata,
  fetchTasks,
  cancelTaskApi,
  moveToInbox,
} = api
