# Editing Cards

Kan uses Markdown for card descriptions. Click anywhere on a description to edit it; press **⌘↵** or click outside to stop editing.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘B | Bold |
| ⌘I | Italic |
| ⌘K | Insert link |
| ⌘↵ | Exit edit mode |
| Escape | Exit edit mode |

**Tip:** For links, select the text you want to link first, then press ⌘K. The URL placeholder will be selected so you can paste or type the URL immediately.

## Epics (parent cards)

Any card can be the parent of others — that makes it an **epic**. On the board, an
epic and its cards render as one Scratch-style block: the epic's card sits in the
header, its cards hang inside the block behind a colored spine, and the color is
derived from the epic so the same epic looks the same in every column.

| Action | How |
|--------|-----|
| Add a card to an epic | Drag it onto the epic's header or drop it inside the block |
| Remove a card from an epic | Open the card and set **Epic** to "No epic" |
| Change which epic a card belongs to | Open the card and pick from the **Epic** dropdown |
| Collapse an epic | Click the chevron in its header |
| Turn grouping off | ⌘E, the toolbar button, or `/epics` |

Epics can nest: a card inside an epic that has cards of its own renders as a block
within a block.

When an epic's card lives in a different column from its cards, the block still
appears in each column its cards are in, headed by the epic's name and the column
its card is in — click that header to open the epic.

Grouping is a *view* arrangement, like the sort dropdown: it never reorders cards
on disk. Dropping a card into a block in another column moves it to that column.

## Supported Markdown

Kan supports [GitHub Flavored Markdown](https://github.github.com/gfm/) (GFM):

- **Bold** and *italic* text
- [Links](https://example.com) and `inline code`
- Bullet lists and numbered lists
- Task lists with checkboxes
- Tables
- Code blocks
- Blockquotes
- ~~Strikethrough~~

### Example

```markdown
## My Card

This is a **bold** statement with a [link](https://example.com).

- [ ] Todo item
- [x] Completed item

| Column A | Column B |
|----------|----------|
| Data 1   | Data 2   |
```
