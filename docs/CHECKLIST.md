# Progress Checklist

## Documentation Alignment
- [x] BASIC.md reviewed and aligned with current scope
- [x] PRD.md reflects updated requirements and acceptance criteria
- [x] TAD.md updated with API/model/process changes
- [x] UI.md referenced for interaction constraints (no UI duplication)

## Core Features
- [x] Inbox uses directory view (left folders, right file list)
- [x] Filename parsing covers title/year/season/episode/resolution/codec tags
- [x] TMDB search supports custom name and optional year
- [x] Auto-match provides candidates with scores
- [x] AI disambiguation available with confidence/reason
- [x] Manual disambiguation available with candidate selection

## Scrape & Process
- [x] Single item scrape (tv/movie) works end-to-end
- [x] Batch scrape with disambiguation mode selection (manual/ai)
- [x] Preview plan for move/overwrite before execution
- [x] Task status tracked (pending/running/success/failed)
- [x] Progress bar shown below list for batch tasks

## TV Library
- [x] Grouped view (scraped/unscraped/new-to-supplement)
- [x] Supplement scrape detects new files in scraped directories
- [x] Season-level metadata refresh supported
- [x] Table columns include assets (poster/NFO) status

## Movie Library
- [x] Table columns include assets (poster/NFO) status
- [x] Refresh metadata from TMDB
- [x] Table supports multi-select and batch actions

## Status & Integrity
- [x] Status shown with icon + color + text
- [x] Asset integrity flags for poster/NFO
- [x] One-click fix for missing assets

## Safety & Controls
- [x] High-risk operations require confirmation
- [x] Impact scope shown before batch execution
- [x] Path access restricted to media directories

## Observability
- [x] Task center or equivalent status view
- [x] Failure reasons captured and visible
- [x] Logs accessible from task details

## Non-Goals Validation
- [x] No multi-user auth introduced
- [x] No streaming/transcoding features added
- [x] No downloader integration added
