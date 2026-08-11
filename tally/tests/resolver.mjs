import { existsSync } from "node:fs";

/**
 * Teaches Node's module loader the two conventions TypeScript lets the source
 * use and plain Node does not: the `@/` path alias, and imports written
 * without a file extension.
 *
 * This exists so `npm test` needs no test framework, no bundler and no extra
 * dependency — Node 24 already strips the types on its own. Thirty lines of
 * resolver is a cheaper thing to own than another package in the tree, and the
 * security document is fairly pointed about which of those two ages worse.
 */

const SRC = new URL("../src/", import.meta.url);
// `/index.ts` before the bare extensions, so `@/data` resolves to the
// directory's entry point rather than failing as an unsupported dir import.
const CANDIDATES = ["/index.ts", ".ts", ".tsx", ".js"];

export function resolve(specifier, context, nextResolve) {
  let url = null;

  if (specifier.startsWith("@/")) {
    url = new URL(specifier.slice(2), SRC).href;
  } else if (specifier.startsWith(".") && context.parentURL) {
    url = new URL(specifier, context.parentURL).href;
  }

  if (url === null) return nextResolve(specifier, context);

  // A bare directory needs its index even though the path itself exists.
  const isDirectory = existsSync(new URL(url)) && !/\.[a-z]+$/i.test(url);

  if ((isDirectory || !existsSync(new URL(url))) && !/\.[cm]?[jt]sx?$/.test(url)) {
    for (const extension of CANDIDATES) {
      if (existsSync(new URL(url + extension))) {
        return nextResolve(url + extension, context);
      }
    }
  }

  return nextResolve(url, context);
}
