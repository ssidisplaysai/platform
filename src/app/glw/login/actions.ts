"use server";

import { redirect } from "next/navigation";
import { createGlwSession, validateGlwCredentials } from "@/lib/glw/auth";

export type GlwLoginState = {
  error?: string;
};

export async function loginToGlw(
  _previousState: GlwLoginState,
  formData: FormData,
): Promise<GlwLoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    if (!validateGlwCredentials(email, password)) {
      return { error: "The email or password is incorrect." };
    }

    await createGlwSession(email.trim().toLowerCase());
  } catch {
    return {
      error:
        "GLW authentication is not configured. Add the required environment variables and try again.",
    };
  }

  redirect("/glw");
}
