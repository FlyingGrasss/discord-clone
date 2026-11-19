import type { Metadata } from "next";
import { requireUser } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * App-area UX guard. Express routes remain the authorization boundary.
 * Route layouts do not receive the current pathname; page-level calls pass
 * their own safe `next` target when the session is missing.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser();
  return <>{children}</>;
}
