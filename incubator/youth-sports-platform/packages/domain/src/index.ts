export type SportCode="softball"|"baseball"|"soccer"|"basketball"|"volleyball"|"football"|"other";
export type EventType="practice"|"game"|"tournament"|"tryout"|"team_event";
export interface Athlete{id:string;familyId:string;firstName:string;lastName:string;birthDate?:string}
export interface Team{id:string;organizationId?:string;sport:SportCode;name:string;seasonId:string}
export interface Venue{id:string;name:string;latitude?:number;longitude?:number}
export interface PlayingSurface{id:string;venueId:string;name:string;type:"diamond"|"field"|"court"|"rink"|"pool"|"track"|"other"}
export interface SportsEvent{id:string;teamId:string;type:EventType;startsAt:string;arrivalAt?:string;venueId?:string;surfaceId?:string}
export interface PitchingAppearance{athleteId:string;gameId:string;pitches:number;strikes:number;inningsPitched:number;strikeouts:number;walks:number;hitsAllowed:number;earnedRuns:number}
