"use client";

import { Dialog as RadixDialog } from "radix-ui";
import { useEffect, useMemo, useRef } from "react";
import { ListView } from "@/features/lists/ListView";
import { Sidebar } from "@/features/lists/Sidebar";
import { SearchView } from "@/features/search/SearchView";
import { TaskInput } from "@/features/tasks/TaskInput";
import { TodayView } from "@/features/today/TodayView";
import { useDataTransfer } from "@/features/data/DataTransfer";
import { cn } from "@/lib/cn";
import { getUserTimezone } from "@/lib/dates";
import { useGlobalShortcuts } from "@/lib/keyboard";
import { subscribeToOtherTabs } from "@/lib/tabSync";
import { useNow } from "@/lib/useNow";
import { selectOpenCount, selectTodayCount } from "@/store/selectors";
import { useTaskStore } from "@/store/useTaskStore";
import { useUIStore } from "@/store/useUIStore";
import { MenuIcon } from "./Icon";
import { LiveRegion } from "./LiveRegion";
import { ErrorNotice, StorageNotice } from "./Notices";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { UndoToast } from "./Toast";

export function AppShell() {
  const status = useTaskStore((s) => s.status);
  const loadAll = useTaskStore((s) => s.loadAll);
  const refresh = useTaskStore((s) => s.refresh);
  const flushPendingDelete = useTaskStore((s) => s.flushPendingDelete);
  const tasks = useTaskStore((s) => s.tasks);
  const lists = useTaskStore((s) => s.lists);
  const inboxId = useTaskStore((s) => s.inboxId);

  const activeView = useUIStore((s) => s.activeView);
  const openList = useUIStore((s) => s.openList);
  const openToday = useUIStore((s) => s.openToday);
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const searchQuery = useUIStore((s) => s.searchQuery);

  const tz = getUserTimezone();
  const now = useNow();
  const dataTransfer = useDataTransfer();
  useGlobalShortcuts();

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // A second tab holds the same data in memory and cannot see this one's
  // writes. Whichever tab changes something says so; the rest re-read.
  useEffect(() => subscribeToOtherTabs(() => void refresh()), [refresh]);

  /**
   * Makes the app itself available offline, which the data already was.
   *
   * Production only. A service worker in front of the dev server answers with
   * yesterday's chunks and calls it a cache hit, and an hour lost to that is an
   * hour nobody gets back. Failure is silent on purpose: no worker means the
   * app works exactly as it did before, which is not an error worth a message.
   */
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  // A deletion still sitting behind its toast when the tab closes should be a
  // deletion, not a task that quietly comes back on the next visit.
  useEffect(() => {
    const flush = () => flushPendingDelete();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [flushPendingDelete]);

  /**
   * The landing rule from the PRD: Today, when there is anything due today or
   * already late. Otherwise Inbox, because an empty Today is a worse first
   * impression than a list you can immediately type into.
   *
   * Decided once, on the first load, and never again — a view that reassigns
   * itself under the user as the clock moves would be maddening.
   */
  const hasRouted = useRef(false);
  useEffect(() => {
    if (status !== "ready" || hasRouted.current) return;
    hasRouted.current = true;

    if (selectTodayCount(tasks, new Date(), tz) === 0 && inboxId) {
      openList(inboxId);
    } else {
      openToday();
    }
  }, [status, tasks, tz, inboxId, openList, openToday]);

  const activeList = useMemo(
    () =>
      activeView.type === "list"
        ? (lists.find((l) => l.id === activeView.listId) ?? null)
        : null,
    [activeView, lists],
  );

  // A task typed while Today is open has no obvious home, so it goes to Inbox
  // rather than forcing a decision the user did not ask to make.
  const captureListId =
    activeView.type === "list" ? activeView.listId : inboxId;

  const heading =
    activeView.type === "today"
      ? "Today"
      : activeView.type === "search"
        ? "Search"
        : (activeList?.name ?? "Inbox");

  const headingCount =
    activeView.type === "today"
      ? selectTodayCount(tasks, now, tz)
      : activeList
        ? selectOpenCount(tasks, activeList.id)
        : 0;

  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      {/* ── Sidebar: fixed from lg, a drawer below it ─────────────────── */}
      <aside className="hidden w-sidebar shrink-0 lg:block">
        <Sidebar
          onExport={dataTransfer.handleExport}
          onImport={dataTransfer.handleImportClick}
        />
      </aside>

      <RadixDialog.Root open={isSidebarOpen} onOpenChange={setSidebarOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay
            className={cn(
              "fixed inset-0 z-40 bg-[rgb(4_14_26_/_0.5)] lg:hidden",
              "data-[state=open]:animate-[tally-fade-in_200ms_ease-out]",
            )}
          />
          <RadixDialog.Content
            aria-label="Lists and settings"
            aria-modal="true"
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-sidebar max-w-[85vw] shadow-lg lg:hidden",
              "data-[state=open]:animate-[tally-slide-in-left_240ms_var(--ease-settle)]",
            )}
          >
            <RadixDialog.Title className="sr-only">
              Lists and settings
            </RadixDialog.Title>
            <Sidebar
              onExport={dataTransfer.handleExport}
              onImport={dataTransfer.handleImportClick}
            />
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-content px-4 pb-24 md:px-6 xl:max-w-content-split">
          <header className="flex items-center gap-3 pb-4 pt-5 md:pt-9">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open lists"
              className={cn(
                "-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md",
                "text-ink-2 transition-colors duration-[120ms] hover:bg-surface-sunk lg:hidden",
              )}
            >
              <MenuIcon size={18} />
            </button>

            <h1 className="engraved min-w-0 flex-1 truncate font-display text-title text-ink">
              {heading}
            </h1>

            {headingCount > 0 ? (
              <span
                className={cn(
                  "rounded-full border border-rule px-2.5 py-1",
                  "bg-[image:var(--sheen)] shadow-[inset_0_1px_0_var(--edge-light)]",
                  "font-mono text-meta tabular text-gilt",
                )}
              >
                {headingCount}
              </span>
            ) : null}
          </header>

          {/* A ruled line under the heading, fading out — the page's masthead. */}
          <div
            aria-hidden="true"
            className="mb-6 h-px bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-gilt)_50%,transparent),var(--color-rule)_40%,transparent)]"
          />

          <StorageNotice onExport={dataTransfer.handleExport} />
          <ErrorNotice />

          {/* The capture field sits above everything, in every view, always
              visible — including on every empty state. */}
          {activeView.type !== "search" ? (
            <div className="pb-6">
              <TaskInput listId={captureListId} />
            </div>
          ) : null}

          {status === "loading" || status === "idle" ? (
            <p className="px-2 py-16 text-center text-meta text-ink-3">
              Opening your tasks…
            </p>
          ) : activeView.type === "search" ? (
            <SearchView tasks={tasks} lists={lists} query={searchQuery} />
          ) : activeView.type === "today" ? (
            <TodayView tasks={tasks} lists={lists} />
          ) : activeList ? (
            <ListView
              list={activeList}
              tasks={tasks}
              lists={lists}
              isFirstRun={tasks.length === 0}
            />
          ) : null}
        </div>
      </main>

      <UndoToast />
      <ShortcutsDialog />
      <LiveRegion />
      {dataTransfer.element}
    </div>
  );
}
