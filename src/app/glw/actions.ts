"use server";

import { redirect } from "next/navigation";
import { destroyGlwSession } from "@/lib/glw/auth";

export async function logoutFromGlw(): Promise<void> {
  await destroyGlwSession();
  redirect("/glw/login");
}
