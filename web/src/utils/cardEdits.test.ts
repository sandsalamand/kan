import { describe, it, expect } from 'vitest';
import type { BoardConfig, Card } from '../api/types';
import { buildCardUpdate } from './cardEdits';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'a_1',
    alias: 'card-one',
    alias_explicit: false,
    title: 'Original title',
    description: 'Original description',
    column: 'todo',
    creator: 'test',
    created_at_millis: 0,
    ...overrides,
  };
}

const boardFields: BoardConfig['custom_fields'] = {
  priority: { type: 'enum', options: [{ value: 'low' }, { value: 'high' }] },
  tags: { type: 'free-set' },
  done: { type: 'boolean' },
};

describe('buildCardUpdate', () => {
  it('returns null when nothing was edited', () => {
    expect(buildCardUpdate(makeCard(), {}, boardFields)).toBeNull();
  });

  // The kan issue #12 case: the modal saves on close, so a card that changed
  // underneath it must not be reverted from the fields nobody touched.
  it('writes nothing when the card changed on disk but the user edited nothing', () => {
    const changedOnDisk = makeCard({ title: 'Renamed on another branch', column: 'doing' });
    expect(buildCardUpdate(changedOnDisk, {}, boardFields)).toBeNull();
  });

  it('sends only the edited field, not the whole card', () => {
    const update = buildCardUpdate(makeCard(), { title: 'New title' }, boardFields);
    expect(update).toEqual({ title: 'New title' });
  });

  it('drops an edit that matches the card again', () => {
    const card = makeCard();
    expect(buildCardUpdate(card, { title: card.title, column: card.column }, boardFields)).toBeNull();
  });

  it('trims title and description', () => {
    const update = buildCardUpdate(makeCard(), { title: '  Padded  ', description: '  text  ' }, boardFields);
    expect(update).toEqual({ title: 'Padded', description: 'text' });
  });

  it('sends an empty parent to clear it, and skips it when already unset', () => {
    expect(buildCardUpdate(makeCard({ parent: 'a_epic' }), { parent: '' }, boardFields)).toEqual({ parent: '' });
    expect(buildCardUpdate(makeCard(), { parent: '' }, boardFields)).toBeNull();
  });

  it('sends changed custom fields in API form', () => {
    const update = buildCardUpdate(makeCard(), { customFields: { priority: 'high', done: true } }, boardFields);
    expect(update).toEqual({ custom_fields: { priority: 'high', done: 'true' } });
  });

  it('ignores a set field whose values only changed order', () => {
    const card = makeCard({ tags: ['b', 'a'] });
    expect(buildCardUpdate(card, { customFields: { tags: ['a', 'b'] } }, boardFields)).toBeNull();
    expect(buildCardUpdate(card, { customFields: { tags: ['a', 'b', 'c'] } }, boardFields)).toEqual({
      custom_fields: { tags: 'a,b,c' },
    });
  });

  it('ignores edits to fields the board no longer defines', () => {
    expect(buildCardUpdate(makeCard(), { customFields: { gone: 'value' } }, boardFields)).toBeNull();
  });

  it('combines several edited fields into one update', () => {
    const update = buildCardUpdate(
      makeCard(),
      { title: 'New', column: 'doing', parent: 'a_epic', customFields: { priority: 'high' } },
      boardFields,
    );
    expect(update).toEqual({
      title: 'New',
      column: 'doing',
      parent: 'a_epic',
      custom_fields: { priority: 'high' },
    });
  });
});
