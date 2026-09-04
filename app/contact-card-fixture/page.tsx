import { notFound } from "next/navigation";
import { ContactCardFixture } from "./ContactCardFixture";

export const dynamic = "force-dynamic";

/**
 * Dev-only surface for measuring the contact capture card without a paid
 * session. Never reachable from a production build.
 */
export default async function ContactCardFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { stage } = await searchParams;
  return <ContactCardFixture stage={stage ?? "permission"} />;
}
