import { LocalRepository } from "./local/LocalRepository";
import { MemoryRepository } from "./local/MemoryRepository";
import { canOpenDatabase, requestPersistentStorage } from "./local/db";
import type { Repository } from "./repository";

export type { Repository } from "./repository";
export { InboxProtectedError, StorageFullError } from "./repository";
export * from "./types";
export { MAX_IMPORT_BYTES, parseBundle, reidentify } from "./bundle";
export type { ParseResult } from "./bundle";

/**
 * The single place the rest of the app gets its data from.
 *
 * Swapping IndexedDB for a Supabase-backed implementation in v2 is a change to
 * this file and nothing else — no component, hook or store action knows or
 * cares which one it is holding.
 */

export interface RepositoryHandle {
  repository: Repository;
  /** False when we fell back to memory, i.e. nothing will survive the tab. */
  durable: boolean;
  /** True when the browser agreed not to evict our data under pressure. */
  persistent: boolean;
}

let handle: Promise<RepositoryHandle> | null = null;

export function getRepository(): Promise<RepositoryHandle> {
  handle ??= open();
  return handle;
}

/**
 * Substitutes the repository. The seam exists for two reasons, both real.
 *
 * Tests use it to drive the store against a repository that can be made to
 * fail on demand — the optimistic-rollback path is otherwise unreachable, and
 * it is the one place in the app where the screen and the database can
 * disagree. And v2 will use the same seam to swap in the Supabase-backed
 * implementation once a user signs in.
 */
export function __setRepositoryForTests(repository: Repository): void {
  handle = Promise.resolve({
    repository,
    durable: repository.isDurable,
    persistent: false,
  });
}

/** Puts the real repository back. */
export function __resetRepository(): void {
  handle = null;
}

async function open(): Promise<RepositoryHandle> {
  if (await canOpenDatabase()) {
    return {
      repository: new LocalRepository(),
      durable: true,
      persistent: await requestPersistentStorage(),
    };
  }

  // Private windows and blocked-storage settings land here. The app carries on
  // working; the UI says plainly that nothing is being saved.
  return {
    repository: new MemoryRepository(),
    durable: false,
    persistent: false,
  };
}
