# Keyboard Shortcuts

## Search Bar

The search bar in the top bar filters the board as you type. Press **/** to focus it from anywhere on the board.

| Shortcut | Action |
|----------|--------|
| / | Focus the search bar |
| Escape | Clear the query (press again to leave the search bar) |

The counter on the right of the bar shows how many cards match; ✕ clears the query.

### How Fuzzy Matching Works

Each word in the query has to match the card somewhere, and different words may match different fields. Against **titles, aliases and custom field values**, a word matches fuzzily: it's split into runs of consecutive characters, where the first run can start anywhere and every later run has to start at a word boundary (a space, punctuation, a camelCase hump, a digit after a letter).

- `payout` matches "Tutor **payout** dashboard" - a plain substring is one run
- `ayou` matches "Tutor p**ayou**t dashboard" - the first run can start mid-word
- `wsp` matches "**W**ise **s**elf-service **p**ayout" - word initials
- `wisepay` matches "**Wise** self-service **pay**out" - two runs
- `wa` matches "**W**hats**A**pp lead capture" - camelCase counts as a boundary
- `fg` does *not* match "fixing a bug" - `g` neither continues `f` nor starts a word

That last case is the point of anchoring runs to word boundaries: any short query is a plain subsequence of almost any long-enough title, so matching without the anchor buries the cards you meant to find.

**Ids and descriptions match by substring only.** Fuzzing an opaque id just turns up coincidences, and descriptions are long enough that even anchored fuzzy matching gets loose.

The query lives in the URL (`?q=`), so a filtered board survives a reload and can be shared as a link.

## Quick Search (Omnibar)

Press **⌘K** to open quick search. Start typing to filter cards in real-time.

| Shortcut | Action |
|----------|--------|
| ⌘K | Open/close quick search |
| ↑ ↓ | Navigate between cards in a column |
| ← → | Navigate between columns |
| Enter | Open highlighted card |
| Escape | Close quick search |

### Slash Commands

Type `/` in quick search to see available commands with autocomplete. Use ↑ ↓ to navigate suggestions and Enter to select.

| Command | Action |
|---------|--------|
| /board | Switch to another board |
| /compact | Toggle compact view |
| /epics | Toggle epic grouping |
| /slim | Toggle slim view (vertical columns) |

### How Filtering Works

Quick search uses **word-based substring matching** - stricter than the search bar's fuzzy matching, and it narrows within whatever the search bar has already filtered to. Each word in your query must appear as a consecutive substring somewhere in the card. Multiple words are AND'd together, but can match different fields. For example:

- `bug` matches "fixing a **bug**" and "de**bug**ging"
- `fix bug` matches a card with "**fix** login" in title and "**bug** report" in description
- `fg` does *not* match "fixing a bug" (not a consecutive substring)

The search looks across all card fields: title, alias, description, and any custom fields defined on your board.

### Filtering Behavior

- Cards that don't match your query disappear from the board
- Empty columns are hidden while filtering
- Drag-and-drop continues to work with the filtered set
- The quick search filter clears when you close quick search; the search bar's query stays until you clear it

## View Modes

| Shortcut | Action |
|----------|--------|
| ⌘C | Toggle compact view |
| ⌘E | Toggle epic grouping |
| ⌘J | Toggle slim view (vertical columns) |

**Compact mode** reduces card padding and hides aliases to show more cards at once.

**Epic grouping** wraps cards that share a `parent` in one colored block, so an epic reads as a unit even when its cards are scattered down the column or split by a sort. See [Editing](editing.md#epics-parent-cards).

**Slim mode** stacks columns vertically for narrow windows. Cards get an advance button (moves to next column) and right-click context menu (move to any column). Card modals are disabled - slim mode is for quick task processing.

## Board

| Shortcut | Action |
|----------|--------|
| 1-9 | Start creating a card in column N |

Columns are numbered left to right starting at 1. If a card creation form is already open in another column, it will close and any draft title you typed will be preserved - press the original number again to return to it. Boards with more than 9 columns will have the remaining columns unreachable by shortcut.

## Card Creation

When typing in the new card input:

| Shortcut | Action |
|----------|--------|
| Enter | Create card and continue adding |
| ⇧↵ | Create card and open field panel |
| ⌘↵ | Create card and open full modal |
| Escape | Cancel and close input |

The **field panel** is a compact popup that appears next to your newly created card, letting you quickly set custom fields (like type, priority, tags) without opening the full modal.

## Undo

Press **⌘Z** to undo and **⇧⌘Z** to redo. The last 20 actions are tracked.

| Action | What Undo Does |
|--------|----------------|
| Card move (drag-and-drop, advance, context menu) | Moves card back to its previous column and position |
| Card delete (inline or modal) | Restores the card with all its original data |
| Card field edit (title, description, custom fields) | Reverts changed fields to their previous values |

Performing a new action after undoing clears the redo history (standard undo/redo behavior).

Undo and redo are aware of external changes. If another process (e.g. the CLI) modifies a card that's on the stack, the operation will be skipped with a notification rather than overwriting the external change.

The undo/redo stacks are cleared when you switch boards or when the board's column/field schema changes externally.

## Card Editor

When editing a card's description:

| Shortcut | Action |
|----------|--------|
| ⌘B | Bold |
| ⌘I | Italic |
| ⌘K | Insert link |
| ⌘↵ | Save and exit edit mode |
| Escape | Save and exit edit mode |

See [Editing Cards](/docs/editing) for details on Markdown support.
