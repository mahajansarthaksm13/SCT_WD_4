"use client";

import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import type { List } from "@/data";

/**
 * The one destructive decision Tally ever asks about, and the reason it asks:
 * deleting a list that still holds tasks has two entirely reasonable meanings,
 * and guessing wrong silently destroys work.
 *
 * An empty list never reaches this dialog — it just goes.
 */
export function DeleteListDialog({
  list,
  taskCount,
  onClose,
  onConfirm,
}: {
  list: List | null;
  taskCount: number;
  onClose: () => void;
  onConfirm: (strategy: "move-to-inbox" | "delete-tasks") => void;
}) {
  return (
    <Dialog
      open={list !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={list ? `Delete "${list.name}"?` : "Delete list?"}
      description={
        taskCount === 1
          ? "This list has 1 task. Choose what happens to it."
          : `This list has ${taskCount} tasks. Choose what happens to them.`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => onConfirm("move-to-inbox")}>
            Move to Inbox
          </Button>
          <Button variant="primary" onClick={() => onConfirm("delete-tasks")}>
            Delete tasks too
          </Button>
        </>
      }
    />
  );
}
