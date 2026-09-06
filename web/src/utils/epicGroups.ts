import type { Card } from '../api/types';
import { stringToColor } from './badgeColors';

/**
 * Epic grouping arranges a column's cards into Scratch-style nested containers
 * based on the card `parent` field. Cards that share a parent are pulled next to
 * each other and wrapped in a group, so an epic reads as one unit even when its
 * members are scattered through the column or split across priorities.
 *
 * This is a *view* arrangement only — nothing on disk is reordered, the same way
 * the custom-field view sort works.
 */

/**
 * Droppable id prefixes for an epic block. Dropping a card on either the header
 * or inside the mouth adds it to the epic — the two halves of "snap into the
 * C-block". Ids carry the column so a drop can move the card there too.
 */
export const EPIC_DROP_PREFIX = 'epic:';
export const EPIC_MOUTH_PREFIX = 'epicmouth:';

export function epicDropId(prefix: string, column: string, epicId: string): string {
  return `${prefix}${column}|${epicId}`;
}

/** Parses an epic droppable id back into its column and epic. */
export function parseEpicDropId(id: string): { column: string; epicId: string } | null {
  const prefix = id.startsWith(EPIC_DROP_PREFIX)
    ? EPIC_DROP_PREFIX
    : id.startsWith(EPIC_MOUTH_PREFIX)
      ? EPIC_MOUTH_PREFIX
      : null;
  if (!prefix) return null;
  const rest = id.slice(prefix.length);
  const sep = rest.indexOf('|');
  if (sep === -1) return null;
  return { column: rest.slice(0, sep), epicId: rest.slice(sep + 1) };
}

export interface EpicCardNode {
  kind: 'card';
  card: Card;
}

export interface EpicGroupNode {
  kind: 'group';
  /** Card ID of the epic. Stable identity for color, collapse state, drop target. */
  epicId: string;
  /** The epic's card. Undefined when the parent lives on another board. */
  epic?: Card;
  /** The epic's card when it lives in *this* column — rendered as the group's head. */
  head?: Card;
  /** Column the epic's card lives in, when that isn't this column. */
  epicColumn?: string;
  children: EpicNode[];
  /** Cards rendered inside this group, all depths, excluding the head. */
  count: number;
}

export type EpicNode = EpicCardNode | EpicGroupNode;

export interface EpicLayout {
  nodes: EpicNode[];
  /** The column's cards in the order they are rendered (depth-first through groups). */
  flat: Card[];
}

/** Deterministic color for an epic, stable across columns and reloads. */
export function epicColor(epicId: string): string {
  return stringToColor(epicId);
}

/**
 * Index for resolving a `parent` reference. Keyed by card ID — the canonical
 * form — and by alias as well, since boards written by older kan versions
 * stored the alias there.
 */
function buildIndex(allCards: Card[]): Map<string, Card> {
  const index = new Map<string, Card>();
  for (const card of allCards) {
    if (card.alias) index.set(card.alias, card);
  }
  for (const card of allCards) {
    index.set(card.id, card); // IDs win over aliases
  }
  return index;
}

/**
 * Resolves a card's parent card, or undefined when there is no usable parent:
 * unset, pointing at another board's card (kan allows that), or part of a
 * parent cycle. A cycle would otherwise recurse forever while building nodes.
 */
function resolveParent(card: Card, index: Map<string, Card>): Card | undefined {
  if (!card.parent) return undefined;
  const parent = index.get(card.parent);
  if (!parent || parent.id === card.id) return undefined;

  const seen = new Set<string>([card.id]);
  let cursor: Card | undefined = parent;
  while (cursor) {
    if (seen.has(cursor.id)) return undefined; // cycle — treat the card as unparented
    seen.add(cursor.id);
    cursor = cursor.parent ? index.get(cursor.parent) : undefined;
  }
  return parent;
}

function countCards(nodes: EpicNode[]): number {
  return nodes.reduce(
    (sum, node) => sum + (node.kind === 'card' ? 1 : 1 + node.count),
    0
  );
}

/**
 * Builds the render tree for one column.
 *
 * @param columnCards the column's cards, in the order they'd otherwise render
 * @param allCards every card on the board — parents may live in other columns
 */
export function buildEpicLayout(columnCards: Card[], allCards: Card[]): EpicLayout {
  const index = buildIndex(allCards);
  const inColumn = new Set(columnCards.map((c) => c.id));

  // Direct children present in this column, keyed by parent id, in column order.
  const childrenByParent = new Map<string, Card[]>();
  for (const card of columnCards) {
    const parent = resolveParent(card, index);
    if (!parent) continue;
    const siblings = childrenByParent.get(parent.id);
    if (siblings) {
      siblings.push(card);
    } else {
      childrenByParent.set(parent.id, [card]);
    }
  }

  const buildCardNode = (card: Card): EpicNode => {
    const kids = childrenByParent.get(card.id);
    if (!kids || kids.length === 0) return { kind: 'card', card };
    const children = kids.map(buildCardNode);
    return {
      kind: 'group',
      epicId: card.id,
      epic: card,
      head: card,
      children,
      count: countCards(children),
    };
  };

  const nodes: EpicNode[] = [];
  const emittedGhosts = new Set<string>();

  for (const card of columnCards) {
    const parent = resolveParent(card, index);

    // Rendered inside its parent's group further down.
    if (parent && inColumn.has(parent.id)) continue;

    if (parent) {
      // The epic's card lives in another column. Anchor a headless group where
      // its first member sits, so the epic still reads as one block here.
      if (emittedGhosts.has(parent.id)) continue;
      emittedGhosts.add(parent.id);
      const children = (childrenByParent.get(parent.id) ?? []).map(buildCardNode);
      nodes.push({
        kind: 'group',
        epicId: parent.id,
        epic: parent,
        epicColumn: parent.column,
        children,
        count: countCards(children),
      });
      continue;
    }

    nodes.push(buildCardNode(card));
  }

  const flat: Card[] = [];
  const collect = (list: EpicNode[]) => {
    for (const node of list) {
      if (node.kind === 'card') {
        flat.push(node.card);
      } else {
        if (node.head) flat.push(node.head);
        collect(node.children);
      }
    }
  };
  collect(nodes);

  return { nodes, flat };
}

/**
 * True when `epicId` is the card itself or one of its descendants. Used to
 * reject a re-parent that would create a cycle (dropping an epic into its own
 * child, say).
 */
export function isSelfOrDescendant(epicId: string, cardId: string, allCards: Card[]): boolean {
  if (epicId === cardId) return true;
  const index = buildIndex(allCards);
  const card = index.get(cardId);
  const seen = new Set<string>();
  let cursor = index.get(epicId);
  while (cursor?.parent) {
    if (seen.has(cursor.id)) return false; // pre-existing cycle; nothing to add
    seen.add(cursor.id);
    const next = index.get(cursor.parent);
    if (next && card && next.id === card.id) return true;
    cursor = next;
  }
  return false;
}
