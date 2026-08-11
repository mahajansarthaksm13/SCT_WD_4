"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  FlagIcon,
  MoreIcon,
  MoveIcon,
  NoteIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/Icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSub,
  MenuTrigger,
} from "@/components/DropdownMenu";
import { PRIORITIES, type List, type Priority, type Task } from "@/data";
import { cn } from "@/lib/cn";

export const PRIORITY_LABELS: Record<Priority, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * Everything a row can do that is not worth a permanent control.
 *
 * Split out of `TaskRow` because it was most of it: seven actions, two
 * submenus and a conditional reorder group, none of which the row itself
 * needs to know anything about.
 */
export function TaskRowMenu({
  task,
  otherLists,
  onRename,
  onOpenNotes,
  onMoveToList,
  onSetPriority,
  onReorder,
  canMoveUp,
  canMoveDown,
  onDelete,
}: {
  task: Task;
  otherLists: List[];
  onRename: () => void;
  onOpenNotes: () => void;
  onMoveToList: (listId: string) => void;
  onSetPriority: (priority: Priority) => void;
  /** Absent in views with their own order, like Today. */
  onReorder?: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDelete: () => void;
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${task.title}`}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-md text-ink-3 md:h-7 md:w-7",
            "transition-colors duration-[120ms] hover:bg-rule hover:text-ink",
          )}
        >
          <MoreIcon size={16} />
        </button>
      </MenuTrigger>

      <MenuContent>
        <MenuItem icon={<PencilIcon size={14} />} onSelect={onRename}>
          Rename
        </MenuItem>
        <MenuItem icon={<NoteIcon size={14} />} onSelect={onOpenNotes}>
          {task.notes ? "Edit note" : "Add a note"}
        </MenuItem>

        <MenuSeparator />

        <MenuSub
          label="Move to list"
          icon={<MoveIcon size={14} />}
          disabled={otherLists.length === 0}
        >
          {otherLists.map((list) => (
            <MenuItem key={list.id} onSelect={() => onMoveToList(list.id)}>
              {list.name}
            </MenuItem>
          ))}
        </MenuSub>

        <MenuSub label="Priority" icon={<FlagIcon size={14} />}>
          {PRIORITIES.map((priority) => (
            <MenuItem key={priority} onSelect={() => onSetPriority(priority)}>
              <span className="flex items-center gap-2">
                {priority === task.priority ? "✓" : "  "}
                {PRIORITY_LABELS[priority]}
              </span>
            </MenuItem>
          ))}
        </MenuSub>

        {onReorder ? (
          <>
            <MenuSeparator />
            <MenuLabel>Reorder</MenuLabel>
            <MenuItem
              icon={<ArrowUpIcon size={14} />}
              disabled={!canMoveUp}
              onSelect={() => onReorder(-1)}
            >
              Move up
            </MenuItem>
            <MenuItem
              icon={<ArrowDownIcon size={14} />}
              disabled={!canMoveDown}
              onSelect={() => onReorder(1)}
            >
              Move down
            </MenuItem>
          </>
        ) : null}

        <MenuSeparator />
        <MenuItem icon={<TrashIcon size={14} />} onSelect={onDelete}>
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
