"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from "@/components/DropdownMenu";
import {
  DownloadIcon,
  KeyboardIcon,
  MoonIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/Icon";
import type { List } from "@/data";
import { cn } from "@/lib/cn";
import { getUserTimezone } from "@/lib/dates";
import { useNow } from "@/lib/useNow";
import { selectOpenCount, selectTodayCount } from "@/store/selectors";
import { useTaskStore } from "@/store/useTaskStore";
import { useUIStore } from "@/store/useUIStore";
import { DeleteListDialog } from "./DeleteListDialog";
import { NewListInput } from "./NewListInput";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Tally";

export function Sidebar({
  onExport,
  onImport,
}: {
  onExport: () => void;
  onImport: () => void;
}) {
  const searchId = useId();
  const tz = getUserTimezone();
  const now = useNow();

  const tasks = useTaskStore((s) => s.tasks);
  const lists = useTaskStore((s) => s.lists);
  const addList = useTaskStore((s) => s.addList);
  const renameList = useTaskStore((s) => s.renameList);
  const removeList = useTaskStore((s) => s.removeList);

  const activeView = useUIStore((s) => s.activeView);
  const openToday = useUIStore((s) => s.openToday);
  const openActivity = useUIStore((s) => s.openActivity);
  const openList = useUIStore((s) => s.openList);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);

  const mounted = useIsClient();
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<List | null>(null);

  // 200ms of quiet before filtering, so typing does not re-render the whole
  // result list on every keystroke.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchDraft, setSearchDraft] = useState(searchQuery);

  const todayCount = useMemo(
    () => selectTodayCount(tasks, now, tz),
    [tasks, now, tz],
  );

  const pendingDeleteCount = pendingDelete
    ? tasks.filter((t) => t.listId === pendingDelete.id).length
    : 0;

  function handleDeleteRequest(list: List) {
    const count = tasks.filter((t) => t.listId === list.id).length;
    // Nothing to lose, nothing to ask about.
    if (count === 0) {
      void removeList(list.id, "delete-tasks");
      if (activeView.type === "list" && activeView.listId === list.id) openToday();
      return;
    }
    setPendingDelete(list);
  }

  return (
    <nav
      aria-label="Lists"
      className={cn(
        // The sidebar is set back into the page rather than sitting on it:
        // darker ground, a shadowed inner edge, and a gilt seam down the join.
        "relative flex h-full flex-col bg-surface-sunk",
        "recessed",
        "after:absolute after:inset-y-0 after:right-0 after:w-px",
        "after:bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--color-gilt)_38%,transparent)_18%,color-mix(in_srgb,var(--color-gilt)_38%,transparent)_82%,transparent)]",
      )}
    >
      <div className="px-5 pb-4 pt-6">
        <p className="engraved font-display text-title leading-none text-ink">
          {APP_NAME}
        </p>
        <p className="mt-2 text-label uppercase text-gilt">Plan by time</p>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="px-3 pb-3">
        <label htmlFor={searchId} className="sr-only">
          Search all tasks
        </label>
        {/*
         * The positioning context is the field itself, not the padded block
         * around it. `top-1/2` centres on whatever is `relative`, so with the
         * padding inside that box the icon was centring on 48px of wrapper
         * rather than 36px of input — six pixels low, and low in a way that
         * reads as sloppy long before anyone works out why.
         */}
        <div className="relative">
          <SearchIcon
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            id={searchId}
            type="search"
            value={searchDraft}
            placeholder="Search"
            data-tally-search
            onChange={(e) => {
              const next = e.target.value;
              setSearchDraft(next);
              if (debounce.current) clearTimeout(debounce.current);
              debounce.current = setTimeout(() => setSearchQuery(next), 200);
            }}
            className={cn(
              "well h-9 w-full rounded-md pl-8 pr-3",
              "text-meta text-ink placeholder:text-ink-3",
              "transition-[border-color,box-shadow] duration-[140ms]",
              "[&::-webkit-search-cancel-button]:appearance-none",
            )}
          />
        </div>
      </div>

      {/* ── Views and lists ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <SidebarRow
          label="Today"
          count={todayCount}
          active={activeView.type === "today"}
          onClick={openToday}
        />
        <SidebarRow
          label="Activity"
          active={activeView.type === "activity"}
          onClick={openActivity}
        />

        {/* A ruled heading, the way a ledger divides its columns. */}
        <p className="engraved flex items-center gap-3 px-2 pb-1.5 pt-6 text-label uppercase text-ink-3">
          Lists
          <span
            aria-hidden="true"
            className="h-px flex-1 bg-[linear-gradient(90deg,var(--color-rule),transparent)]"
          />
        </p>

        <ul className="space-y-0.5">
          {lists.map((list) => (
            <li key={list.id}>
              {renamingId === list.id ? (
                <NewListInput
                  initialValue={list.name}
                  placeholder="List name"
                  onCommit={(name) => {
                    void renameList(list.id, name);
                    setRenamingId(null);
                  }}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <SidebarRow
                  label={list.name}
                  count={selectOpenCount(tasks, list.id)}
                  active={
                    activeView.type === "list" && activeView.listId === list.id
                  }
                  onClick={() => openList(list.id)}
                  menu={
                    // Inbox is not renameable and not deletable, in the UI and
                    // in the repository both. Every task needs somewhere to go.
                    list.isDefault ? null : (
                      <Menu>
                        <MenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${list.name}`}
                            className={cn(
                              "tap-target flex h-6 w-6 items-center justify-center rounded-md text-ink-3",
                              "transition-colors duration-[120ms] hover:bg-rule hover:text-ink",
                            )}
                          >
                            <MoreIcon size={14} />
                          </button>
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem
                            icon={<PencilIcon size={14} />}
                            onSelect={() => setRenamingId(list.id)}
                          >
                            Rename
                          </MenuItem>
                          <MenuItem
                            icon={<TrashIcon size={14} />}
                            onSelect={() => handleDeleteRequest(list)}
                          >
                            Delete list
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    )
                  }
                />
              )}
            </li>
          ))}
        </ul>

        <div className="mt-1">
          {creating ? (
            <NewListInput
              placeholder="New list name"
              onCommit={(name) => {
                void addList(name);
                setCreating(false);
              }}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={cn(
                "flex h-11 w-full items-center gap-2 rounded-md px-2 text-body text-ink-2 lg:h-9",
                "transition-colors duration-[120ms] hover:bg-surface-sunk hover:text-ink",
              )}
            >
              <PlusIcon size={14} />
              New list
            </button>
          )}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="border-t border-rule px-3 py-2 shadow-[inset_0_1px_0_var(--edge-light)]">
        <div className="flex items-center gap-1">
          <FooterButton
            /*
             * The stored identifiers are still "mahogany" and "porcelain" —
             * they are a persisted value in every existing user's browser, and
             * renaming them would be a data migration dressed up as a colour
             * change. Only the words the user reads follow the palette.
             */
            label={
              !mounted
                ? "Switch theme"
                : theme === "mahogany"
                  ? "Switch to the powder theme"
                  : "Switch to the navy theme"
            }
            onClick={toggleTheme}
          >
            {mounted && theme === "mahogany" ? (
              <SunIcon size={15} />
            ) : (
              <MoonIcon size={15} />
            )}
          </FooterButton>
          <FooterButton label="Export your tasks as a file" onClick={onExport}>
            <DownloadIcon size={15} />
          </FooterButton>
          <FooterButton label="Import tasks from a file" onClick={onImport}>
            <UploadIcon size={15} />
          </FooterButton>
          <FooterButton
            label="Keyboard shortcuts"
            onClick={() => setShortcutsOpen(true)}
          >
            <KeyboardIcon size={15} />
          </FooterButton>
        </div>
        <p className="px-2 pb-1 pt-2 text-meta leading-[16px] text-ink-3">
          Saved in this browser, on this device.
        </p>
      </div>

      <DeleteListDialog
        list={pendingDelete}
        taskCount={pendingDeleteCount}
        onClose={() => setPendingDelete(null)}
        onConfirm={(strategy) => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (!target) return;
          void removeList(target.id, strategy);
          if (activeView.type === "list" && activeView.listId === target.id) {
            openToday();
          }
        }}
      />
    </nav>
  );
}

function SidebarRow({
  label,
  count,
  active,
  onClick,
  menu,
}: {
  label: string;
  /** Omitted by views that do not count open tasks, like Activity. */
  count?: number;
  active: boolean;
  onClick: () => void;
  menu?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative flex h-11 items-center rounded-md pr-1 lg:h-9",
        "transition-[background-color,box-shadow] duration-[140ms]",
        active
          ? // The selected list is a raised plate with a gilt tab at its edge.
            cn(
              "bg-accent-soft bg-[image:var(--sheen)]",
              "shadow-[inset_0_1px_0_var(--edge-light),0_2px_6px_-3px_var(--cast)]",
              "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px]",
              "before:rounded-full before:bg-gilt before:content-['']",
            )
          : "hover:bg-[color-mix(in_srgb,var(--color-ink)_6%,transparent)]",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        aria-label={
          count === undefined
            ? label
            : `${label}, ${count === 1 ? "1 open task" : `${count} open tasks`}`
        }
        className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left"
      >
        <span
          className={cn(
            "flex-1 truncate text-body font-medium",
            active ? "text-ink" : "text-ink-2",
          )}
        >
          {label}
        </span>
        {count !== undefined && count > 0 ? (
          <span
            aria-hidden="true"
            className={cn(
              "min-w-6 rounded-full px-1.5 py-0.5 text-center font-mono text-meta tabular",
              active
                ? "pip bg-gilt text-on-accent"
                : "text-ink-3",
            )}
          >
            {count}
          </span>
        ) : null}
      </button>

      {menu ? (
        <span
          className={cn(
            "shrink-0 transition-opacity duration-[120ms]",
            "[@media(hover:hover)]:opacity-0",
            "[@media(hover:hover)]:group-hover:opacity-100",
            "[@media(hover:hover)]:group-focus-within:opacity-100",
          )}
        >
          {menu}
        </span>
      ) : null}
    </div>
  );
}

/**
 * False while rendering on the server, true once the page is live.
 *
 * The theme is decided by the viewer's system preference and by localStorage,
 * neither of which the server can see — so the toggle has to stay neutral
 * until it can read the real answer, rather than guessing and being visibly
 * corrected a moment later.
 *
 * `useSyncExternalStore` is the sanctioned way to express "this value differs
 * between server and client": React switches snapshots as part of hydration
 * instead of it being a render that corrects the render before it.
 */
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function FooterButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-md text-ink-3 lg:h-9 lg:w-9",
        "transition-colors duration-[120ms] hover:bg-surface-sunk hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
