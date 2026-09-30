# Architecture

## Core principle

Clients call a stable cloud API. The web app and later native apps are clients of the same backend.

```
Web/PWA ----\
             >---- API ---- PostgreSQL/PostGIS
iOS/Android-/        |---- Realtime events
                     |---- S3 media
                     |---- Notifications
```

## Recommended application stack

### Web
- Next.js
- TypeScript
- mobile-first
- PWA manifest/service worker
- accessible responsive UI

### API
- TypeScript
- modular service architecture
- REST first
- WebSocket/realtime channel for scores, presence, chat, and event updates
- OpenAPI contract generated from source

### Data
- PostgreSQL
- PostGIS for venue/field geometry and proximity
- migrations committed to Git
- no direct client-to-database access

### Media
- object storage for photos/video
- signed upload/download URLs
- CDN delivery
- future transcoding/streaming pipeline

### Identity
- adult account is the primary authenticated identity
- minors are athlete profiles linked to guardians
- permissions are explicit and scoped
- no default public minor location/schedule exposure

## Domain boundaries

- Identity
- Family
- Athlete
- Organization
- Team
- Sport
- Season
- Event
- Venue
- Game
- Stats
- Messaging
- Notifications
- Media

## Sport abstraction

Sport-specific rules extend shared primitives.

Example:
- Event exists for every sport
- Game exists for competitive events
- Softball adds innings, plate appearances, pitches, pitcher stats
- Basketball later adds periods, possessions, fouls, shot events

Do not encode softball-specific assumptions into Family, Team, Event, Venue, or Media.
