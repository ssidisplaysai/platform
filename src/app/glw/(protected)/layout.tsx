import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GlwShell } from "@/components/glw/glw-shell";
import { getGlwSession } from "@/lib/glw/auth";

export const metadata: Metadata = {
  title: "GLW",
  description: "GLW application console.",
};

export default async function ProtectedGlwLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getGlwSession();

  if (!session) {
    redirect("/glw/login");
  }

  return <GlwShell>{children}</GlwShell>;
}
