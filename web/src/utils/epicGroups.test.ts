import { describe, it, expect } from 'vitest';
import type { Card } from '../api/types';
import { buildEpicLayout, isSelfOrDescendant, parseEpicDropId, epicDropId, EPIC_DROP_PREFIX } from './epicGroups';

function card(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    alias: `alias-${id}`,
    alias_explicit: false,
    title: `Card ${id}`,
    column: 'todo',
    creator: 'test',
    created_at_millis: 0,
    ...overrides,
  };
}

/** Node kinds in render order, e.g. ['card:a', 'group:epic'] */
function shape(nodes: ReturnType<typeof buildEpicLayout>['nodes']): string[] {
  return nodes.map((n) => (n.kind === 'card' ? `card:${n.card.id}` : `group:${n.epicId}`));
}

describe('buildEpicLayout', () => {
  it('leaves unparented cards flat', () => {
    const cards = [card('a'), card('b')];
    const layout = buildEpicLayout(cards, cards);
    expect(shape(layout.nodes)).toEqual(['card:a', 'card:b']);
    expect(layout.flat.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('pulls scattered members up under their epic', () => {
    const epic = card('epic');
    const cards = [epic, card('x'), card('m1', { parent: 'epic' }), card('y'), card('m2', { parent: 'epic' })];
    const layout = buildEpicLayout(cards, cards);

    expect(shape(layout.nodes)).toEqual(['group:epic', 'card:x', 'card:y']);
    // Members render together, right after the epic's own card.
    expect(layout.flat.map((c) => c.id)).toEqual(['epic', 'm1', 'm2', 'x', 'y']);
  });

  it('anchors a headless group where the epic card is in another column', () => {
    const epic = card('epic', { column: 'doing' });
    const columnCards = [card('x'), card('m1', { parent: 'epic' })];
    const layout = buildEpicLayout(columnCards, [epic, ...columnCards]);

    expect(shape(layout.nodes)).toEqual(['card:x', 'group:epic']);
    const group = layout.nodes[1];
    expect(group.kind === 'group' && group.head).toBeUndefined();
    expect(group.kind === 'group' && group.epicColumn).toBe('doing');
  });

  it('nests a member that is itself an epic, and counts all depths', () => {
    const cards = [
      card('epic'),
      card('mid', { parent: 'epic' }),
      card('leaf', { parent: 'mid' }),
    ];
    const layout = buildEpicLayout(cards, cards);

    expect(shape(layout.nodes)).toEqual(['group:epic']);
    const outer = layout.nodes[0];
    if (outer.kind !== 'group') throw new Error('expected group');
    expect(outer.count).toBe(2); // mid + leaf
    expect(shape(outer.children)).toEqual(['group:mid']);
    expect(layout.flat.map((c) => c.id)).toEqual(['epic', 'mid', 'leaf']);
  });

  it('resolves a parent stored as an alias (boards written by older kan)', () => {
    const epic = card('epic');
    const cards = [epic, card('m1', { parent: 'alias-epic' })];
    const layout = buildEpicLayout(cards, cards);
    expect(shape(layout.nodes)).toEqual(['group:epic']);
  });

  it('ignores parent cycles instead of recursing forever', () => {
    const cards = [card('a', { parent: 'b' }), card('b', { parent: 'a' })];
    const layout = buildEpicLayout(cards, cards);
    expect(layout.flat).toHaveLength(2);
  });

  it('drops no card when the parent is unknown (another board)', () => {
    const cards = [card('a', { parent: 'card-on-another-board' })];
    const layout = buildEpicLayout(cards, cards);
    expect(shape(layout.nodes)).toEqual(['card:a']);
  });
});

describe('isSelfOrDescendant', () => {
  const cards = [card('epic'), card('mid', { parent: 'epic' }), card('leaf', { parent: 'mid' })];

  it('rejects a card joining itself', () => {
    expect(isSelfOrDescendant('epic', 'epic', cards)).toBe(true);
  });

  it('rejects a card joining its own descendant', () => {
    expect(isSelfOrDescendant('leaf', 'epic', cards)).toBe(true);
  });

  it('allows an unrelated card', () => {
    expect(isSelfOrDescendant('epic', 'leaf', cards)).toBe(false);
  });
});

describe('epic droppable ids', () => {
  it('round-trips column and epic id', () => {
    const id = epicDropId(EPIC_DROP_PREFIX, 'not-started', 'a_123');
    expect(parseEpicDropId(id)).toEqual({ column: 'not-started', epicId: 'a_123' });
  });

  it('returns null for card and column ids', () => {
    expect(parseEpicDropId('a_123')).toBeNull();
    expect(parseEpicDropId('not-started')).toBeNull();
  });
});
