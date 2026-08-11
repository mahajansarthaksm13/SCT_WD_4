"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { announce } from "@/lib/announcer";
import { track } from "@/lib/analytics";
import {
  MAX_IMPORT_BYTES,
  parseBundle,
  reidentify,
  type ExportBundle,
} from "@/data";
import { useTaskStore } from "@/store/useTaskStore";

/**
 * Export and import.
 *
 * Export is promoted to a must-have here rather than treated as a nicety. With
 * no account and no server, a browser that clears its storage takes everything
 * with it — and browsers do that, on a schedule, without asking. A file the
 * user holds is the only thing standing between them and losing the lot.
 */

type Staged = { bundle: ExportBundle; error: null } | { bundle: null; error: string };

export function useDataTransfer() {
  const tasks = useTaskStore((s) => s.tasks);
  const exportAll = useTaskStore((s) => s.exportAll);
  const importAll = useTaskStore((s) => s.importAll);
  const inboxId = useTaskStore((s) => s.inboxId);

  const fileInput = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<Staged | null>(null);

  async function handleExport() {
    const bundle = await exportAll();
    if (!bundle) return;

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `tally-export-${bundle.exportedAt.slice(0, 10)}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
    track({ name: "data_exported" });
    announce(
      `Exported ${bundle.tasks.length} tasks across ${bundle.lists.length} lists.`,
    );
  }

  function handleImportClick() {
    fileInput.current?.click();
  }

  async function handleFileChosen(file: File) {
    if (file.size > MAX_IMPORT_BYTES) {
      setStaged({
        bundle: null,
        error: "That file is larger than 5 MB. Nothing was changed.",
      });
      return;
    }

    const result = parseBundle(await file.text());
    setStaged(
      result.ok
        ? { bundle: reidentify(result.bundle, inboxId), error: null }
        : { bundle: null, error: result.error },
    );
  }

  const element = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so choosing the same file twice in a row still fires.
          e.target.value = "";
          if (file) void handleFileChosen(file);
        }}
      />

      <Dialog
        open={staged !== null}
        onOpenChange={(open) => {
          if (!open) setStaged(null);
        }}
        title={staged?.error ? "That file could not be read" : "Import these tasks?"}
        description={
          staged?.error ??
          (staged?.bundle
            ? `The file holds ${countLabel(staged.bundle.tasks.length, "task")} in ${countLabel(staged.bundle.lists.length, "list")}. You have ${countLabel(tasks.length, "task")} right now.`
            : undefined)
        }
        footer={
          staged?.error ? (
            <Button variant="primary" onClick={() => setStaged(null)}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStaged(null)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (staged?.bundle) void importAll(staged.bundle, "replace");
                  setStaged(null);
                }}
              >
                Replace everything
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (staged?.bundle) void importAll(staged.bundle, "merge");
                  setStaged(null);
                }}
              >
                Add to what I have
              </Button>
            </>
          )
        }
      >
        {staged?.bundle ? (
          <p className="text-meta text-ink-2">
            &ldquo;Add to what I have&rdquo; keeps your current tasks and brings
            the file&rsquo;s in alongside them. &ldquo;Replace everything&rdquo;
            removes what is here first — export a copy before you do that if you
            are not certain.
          </p>
        ) : null}
      </Dialog>
    </>
  );

  return { handleExport, handleImportClick, element };
}

function countLabel(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}
