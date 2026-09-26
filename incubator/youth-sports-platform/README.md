# Youth Sports Platform Bootstrap

Status: architecture/bootstrap only. This subtree is intentionally isolated from Genesis/GLW production code and is designed to be migrated into a dedicated repository.

## Product authority

Build a web-first, mobile-ready youth sports platform for families, athletes, teams, events, venues, scoring, communication, media, and later live streaming.

Softball is the first reference sport. The domain model must remain sport-agnostic.

## Non-negotiable runtime rule

GLW/Genesis is the development and operational control plane. The sports platform is an independently deployed cloud application.

Production operation must never depend on:
- a developer laptop
- a local filesystem
- an active ChatGPT session
- a manually running GLW process
- Genesis availability at request time

## Initial client strategy

1. Mobile-first responsive web app
2. Progressive Web App (PWA)
3. Native iOS/Android later using the same backend API

## Initial product modules

- Authentication
- Family and guardians
- Athlete profiles
- Teams and rosters
- Seasons
- Calendar/events
- Venues and playing surfaces
- RSVP and event check-in
- Team announcements
- Push notifications
- Softball game center
- Basic scoring and pitcher statistics
- Photos/media

## Repository target structure

- apps/web - Next.js PWA
- apps/api - application API
- packages/domain - shared domain types and rules
- packages/ui - shared UI components
- packages/config - shared configuration
- infra/aws - infrastructure as code
- docs - architecture and product authority

## Environments

- local
- staging
- production

No production secret may be committed to Git.
