export type GlwProductRegistryEntry = {
  id: string;
  name: string;
  canonicalTopic: string;
  pageFamily: "core" | "rental" | "outdoor" | "venue";
  priority: number;
};

export const GLW_PRODUCT_REGISTRY: GlwProductRegistryEntry[] = [
  { id: "direct_view_led_video_walls", name: "Direct View LED Video Walls", canonicalTopic: "direct view led video walls", pageFamily: "core", priority: 1 },
  { id: "led_wall_rental", name: "LED Wall Rental", canonicalTopic: "led wall rental", pageFamily: "rental", priority: 2 },
  { id: "outdoor_led_displays", name: "Outdoor LED Displays", canonicalTopic: "outdoor led displays", pageFamily: "outdoor", priority: 3 },
  { id: "commercial_led_displays", name: "Commercial LED Displays", canonicalTopic: "commercial led displays", pageFamily: "core", priority: 4 },
  { id: "digital_signage", name: "Digital Signage", canonicalTopic: "digital signage", pageFamily: "core", priority: 5 },
  { id: "stadium_led_displays", name: "Stadium LED Displays", canonicalTopic: "stadium led displays", pageFamily: "venue", priority: 6 },
  { id: "event_led_walls", name: "Event LED Walls", canonicalTopic: "event led walls", pageFamily: "venue", priority: 7 },
  { id: "projection_screens", name: "Projection Screens", canonicalTopic: "projection screens", pageFamily: "venue", priority: 8 },
  { id: "rental_projection", name: "Rental Projection", canonicalTopic: "rental projection", pageFamily: "rental", priority: 9 },
  { id: "indoor_led_displays", name: "Indoor LED Displays", canonicalTopic: "indoor led displays", pageFamily: "core", priority: 10 },
  { id: "fine_pitch_led_displays", name: "Fine Pitch LED Displays", canonicalTopic: "fine pitch led displays", pageFamily: "core", priority: 11 },
  { id: "transparent_led_displays", name: "Transparent LED Displays", canonicalTopic: "transparent led displays", pageFamily: "venue", priority: 12 },
  { id: "creative_led_displays", name: "Creative LED Displays", canonicalTopic: "creative led displays", pageFamily: "venue", priority: 13 },
  { id: "rental_led_video_walls", name: "Rental LED Video Walls", canonicalTopic: "rental led video walls", pageFamily: "rental", priority: 14 },
];

export function getGlwProduct(productId: string): GlwProductRegistryEntry | null {
  return GLW_PRODUCT_REGISTRY.find((product) => product.id === productId) ?? null;
}
