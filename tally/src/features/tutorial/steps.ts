/**
 * The tour, as data.
 *
 * Kept apart from the overlay that draws it so the script can be read as a
 * script — in order, in one screen — and argued with. A tour that has drifted
 * out of step with the product is worse than no tour, and the easiest way for
 * that to happen is to bury the wording inside layout code.
 *
 * `target` is a `data-tour` attribute rather than a class or an id: classes are
 * styling and move constantly, ids are for labelling. A missing target is not
 * an error — the step simply loses its spotlight and centres itself, which is
 * what happens on a first visit where there are no task rows to point at yet.
 */

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** `[data-tour="…"]`. Omitted for steps that talk about the app as a whole. */
  target?: string;
  /** Switch to this view before the step is shown. */
  view?: "today" | "inbox" | "activity";
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Tally plans by time",
    body: "Most to-do apps ask which list a thing belongs to. This one asks when it is due, and arranges everything around that. Two minutes and you will have seen all of it.",
    view: "inbox",
  },
  {
    id: "capture",
    title: "Type, press Enter, keep typing",
    body: "One field, always visible, always focused. It clears and holds focus when you submit, so ten tasks take ten sentences and no mouse. An empty submission is ignored rather than answered with an error.",
    target: "capture",
    view: "inbox",
  },
  {
    id: "due",
    title: "A date, and a time if it has one",
    body: "Both optional. A task due Tuesday and a task due Tuesday at 18:00 are different things and are stored as different things, which is why a dateless task never shows up as 12:00 AM.",
    target: "due",
    view: "inbox",
  },
  {
    id: "repeat",
    title: "Things that come back",
    body: "In the same popover: daily, weekly, monthly or yearly. Ticking a repeating task keeps the one you ticked as the record of what you did, and opens the next one. Untick it and the next one goes away again — even after a reload.",
    target: "due",
    view: "inbox",
  },
  {
    id: "gutter",
    title: "The time column is the spine",
    body: "Every row starts with its time, right-aligned in figures that are all the same width, so the day reads as a column of numbers before you read a single word. A task with no time shows an em-dash on the same edge — the absence of a time is information too.",
    target: "main",
    view: "inbox",
  },
  {
    id: "row",
    title: "Everything a task can do",
    body: "Click the box to tick it. Double-click the title to rename it in place. The ⋯ menu holds notes, priority, moving it to another list, reordering, and delete. Drag a row by its handle to reorder it, or use Alt with the arrow keys.",
    target: "main",
    view: "inbox",
  },
  {
    id: "undo",
    title: "Undo, never confirm",
    body: "Deleting takes one click and no dialog — a five-second undo appears at the bottom instead. A confirmation prompt taxes the ninety-nine deletions in a hundred that you meant, to guard the one you did not.",
    target: "main",
    view: "inbox",
  },
  {
    id: "today",
    title: "Today answers what now",
    body: "Everything still open across every list that is due before tonight, with anything already late pulled out and put on top. Undated tasks never appear here — something with no date is not an answer to that question. It rolls over at midnight on its own.",
    target: "today",
    view: "today",
  },
  {
    id: "completed",
    title: "Finished work stays visible",
    body: "Completed tasks collapse into their own section rather than vanishing. On a wide screen they sit in a column beside the open list, grouped by the day you actually finished them.",
    target: "main",
    view: "today",
  },
  {
    id: "lists",
    title: "Lists, and the one that cannot go",
    body: "Make as many as you like. Deleting a list that still holds tasks asks what should happen to them first. Inbox cannot be deleted, because every task needs somewhere to live.",
    target: "new-list",
    view: "inbox",
  },
  {
    id: "search",
    title: "Search covers notes too",
    body: "Type here, or press / from anywhere. It looks through titles and notes, ignores case, and puts anything still open above anything already done.",
    target: "search",
  },
  {
    id: "activity",
    title: "A year of days",
    body: "One square per day, darkest where you finished the most. A square with a ring around it is a day that ended still owing something. Click any square to see exactly what you finished that day, and what you did not.",
    target: "activity-grid",
    view: "activity",
  },
  {
    id: "footer",
    title: "Theme, export, import, shortcuts",
    body: "Switch between the navy and powder themes, take your whole database out as one file, put one back, or see every keyboard shortcut. Press ? at any time for that last one.",
    target: "footer",
  },
  {
    id: "storage",
    title: "It is all on this device",
    body: "No account, no server, nothing sent anywhere. Your tasks live in this browser, and the app works with the network switched off — you can install it to a home screen. That also means clearing this browser's data clears your tasks, so the export button is not decoration.",
    target: "footer",
  },
];
