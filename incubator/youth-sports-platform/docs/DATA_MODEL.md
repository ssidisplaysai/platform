# Initial Data Model

## Identity
- User
- Guardian
- Athlete
- Family
- FamilyMembership

## Organizations
- Organization
- Club
- League
- Team
- TeamMembership
- Season

## Scheduling
- Event
- EventParticipant
- RSVP
- CheckIn

Event types:
- practice
- game
- tournament
- tryout
- team_event

## Places
- Venue
- PlayingSurface
- ParkingArea
- VenueAmenity

Playing surface types:
- diamond
- field
- court
- rink
- pool
- track
- other

Venue and surface geometry use PostGIS.

## Competition
- Game
- GameParticipant
- GamePeriod
- GameEvent

## Softball extension
- SoftballGameState
- Inning
- PlateAppearance
- Pitch
- PitchingAppearance
- SoftballPlayerGameStats

Pitcher metrics should be derivable from immutable game events where practical.

## Communication
- Conversation
- ConversationMember
- Message
- Announcement

## Media
- MediaAsset
- MediaLink
- Clip
- Album

Media can link to:
- athlete
- team
- event
- game
- game event

## Audit and safety
Every sensitive mutation should carry:
- actor user id
- timestamp
- source
- before/after or event payload where appropriate

Location/check-in data should be event-scoped and expire according to policy.
