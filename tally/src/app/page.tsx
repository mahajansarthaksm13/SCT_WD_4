import { AppShell } from "@/components/AppShell";

/**
 * Tally is entirely client-side: the data lives in the browser, so there is
 * nothing for a server to render and nothing to wait on before first paint.
 * The page is a shell; everything below it is a client component.
 */
export default function Page() {
  return <AppShell />;
}
