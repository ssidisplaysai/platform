import { getGlwSession } from "@/lib/glw/auth";

export function leak() {
  return getGlwSession;
}
