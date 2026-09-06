import { describe, it, expect } from 'vitest';
import { cardFuzzyMatchesQuery, cardMatchesQuery, filterCards, fuzzyMatch, fuzzyWordMatch } from './fuzzyMatch';
import type { Card, BoardConfig } from '../api/types';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'a_sQiNQyD3',
    alias: 'omnibar-search',
    alias_explicit: true,
    title: 'omnibar search should include card IDs',
    description: 'Searching by ID makes it easy to jump to a known card.',
    column: 'in-progress',
    creator: 'Alexander Terp',
    created_at_millis: 0,
    ...overrides,
  };
}

const emptyBoard: BoardConfig = {
  id: 'b_test',
  name: 'test',
  columns: [],
  default_column: 'todo',
};

const boardWithCustomFields: BoardConfig = {
  ...emptyBoard,
  custom_fields: {
    type: { type: 'enum' },
    tags: { type: 'enum-set' },
  },
};

describe('fuzzyMatch', () => {
  it('matches case-insensitively', () => {
    expect(fuzzyMatch('BUG', 'fixing a bug')).toBe(true);
    expect(fuzzyMatch('fix', 'PREFIX')).toBe(true);
  });

  it('requires consecutive substring', () => {
    expect(fuzzyMatch('fg', 'fixing a bug')).toBe(false);
  });
});

describe('fuzzyWordMatch', () => {
  it('matches a plain substring, mid-word included', () => {
    expect(fuzzyWordMatch('payout', 'Tutor payout dashboard')).toBe(true);
    expect(fuzzyWordMatch('ayou', 'Tutor payout dashboard')).toBe(true);
  });

  it('matches word initials', () => {
    expect(fuzzyWordMatch('wsp', 'Wise self-service payout')).toBe(true);
    expect(fuzzyWordMatch('tpd', 'Tutor payout dashboard')).toBe(true);
  });

  it('matches runs that each start a word', () => {
    expect(fuzzyWordMatch('wisepay', 'Wise self-service payout')).toBe(true);
    expect(fuzzyWordMatch('tutdash', 'Tutor payout dashboard')).toBe(true);
  });

  it('treats camelCase humps and digits as word starts', () => {
    expect(fuzzyWordMatch('wa', 'WhatsApp lead capture')).toBe(true);
    expect(fuzzyWordMatch('w2', 'Wise v2 migration')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(fuzzyWordMatch('WSP', 'wise self-service payout')).toBe(true);
  });

  it('rejects characters scattered mid-word', () => {
    // the letters are all there in order, but "y" starts nothing
    expect(fuzzyWordMatch('payout', 'Salesperson should see when parents give')).toBe(false);
    expect(fuzzyWordMatch('fg', 'fixing a bug')).toBe(false);
  });

  it('requires the right order', () => {
    expect(fuzzyWordMatch('psw', 'Wise self-service payout')).toBe(false);
  });

  it('requires every character to be present', () => {
    expect(fuzzyWordMatch('wspz', 'Wise self-service payout')).toBe(false);
  });

  it('matches an empty query', () => {
    expect(fuzzyWordMatch('', 'anything')).toBe(true);
  });

  it('rejects a query longer than the target', () => {
    expect(fuzzyWordMatch('wise self-service', 'wise')).toBe(false);
  });
});

describe('cardFuzzyMatchesQuery', () => {
  it('returns true for an empty query', () => {
    expect(cardFuzzyMatchesQuery(makeCard(), '', emptyBoard)).toBe(true);
    expect(cardFuzzyMatchesQuery(makeCard(), '   ', emptyBoard)).toBe(true);
  });

  it('matches a title fuzzily', () => {
    expect(cardFuzzyMatchesQuery(makeCard(), 'omnisearch', emptyBoard)).toBe(true);
    expect(cardFuzzyMatchesQuery(makeCard(), 'oscard', emptyBoard)).toBe(true);
  });

  it('matches an alias fuzzily', () => {
    const card = makeCard({ title: 'unrelated', description: undefined });
    expect(cardFuzzyMatchesQuery(card, 'omnsearch', emptyBoard)).toBe(true);
  });

  it('matches custom field values fuzzily', () => {
    const card = makeCard({ title: 'unrelated', description: undefined, type: 'feature-request' });
    expect(cardFuzzyMatchesQuery(card, 'fr', boardWithCustomFields)).toBe(true);
    expect(cardFuzzyMatchesQuery(card, 'featreq', boardWithCustomFields)).toBe(true);
  });

  it('still matches plain substrings', () => {
    expect(cardFuzzyMatchesQuery(makeCard(), 'include card', emptyBoard)).toBe(true);
  });

  it('combines words with AND across fields', () => {
    const card = makeCard({ type: 'feature-request' });
    expect(cardFuzzyMatchesQuery(card, 'fr omnib', boardWithCustomFields)).toBe(true);
  });

  it('fails when one word matches nothing', () => {
    expect(cardFuzzyMatchesQuery(makeCard(), 'omnibar zzzz', emptyBoard)).toBe(false);
  });

  it('matches descriptions by substring only, never fuzzily', () => {
    const card = makeCard({ title: 'unrelated', alias: 'unrelated' });
    expect(cardFuzzyMatchesQuery(card, 'jump to a known', emptyBoard)).toBe(true);
    // "by id makes" — word initials that would match if descriptions were fuzzy
    expect(cardFuzzyMatchesQuery(card, 'bim', emptyBoard)).toBe(false);
  });

  it('matches ids by substring only, so opaque ids stay quiet', () => {
    const card = makeCard({ title: 'unrelated', alias: 'unrelated', description: undefined });
    expect(cardFuzzyMatchesQuery(card, 'sqinqy', emptyBoard)).toBe(true);
    // a_sQiNQyD3 has camel humps a fuzzy match would happily jump between
    expect(cardFuzzyMatchesQuery(card, 'sqd', emptyBoard)).toBe(false);
  });
});

describe('filterCards', () => {
  const wise = makeCard({
    id: 'a_wise1',
    alias: 'wise-payouts',
    title: 'Wise self-service payout details',
    description: undefined,
  });
  const ses = makeCard({
    id: 'a_ses1',
    alias: 'ses-emails',
    title: 'SES marketing emails',
    description: undefined,
  });
  const cards = [wise, ses];

  it('returns every card when both queries are empty', () => {
    expect(filterCards(cards, emptyBoard, '', '')).toEqual(cards);
    expect(filterCards(cards, emptyBoard, '  ', '  ')).toEqual(cards);
  });

  it('filters by the search query, fuzzily', () => {
    expect(filterCards(cards, emptyBoard, 'wsp', '')).toEqual([wise]);
  });

  it('filters by the omnibar query, by substring', () => {
    expect(filterCards(cards, emptyBoard, '', 'marketing')).toEqual([ses]);
    expect(filterCards(cards, emptyBoard, '', 'smrktng')).toEqual([]);
  });

  it('applies both queries together', () => {
    expect(filterCards(cards, emptyBoard, 'wsp', 'payout')).toEqual([wise]);
    expect(filterCards(cards, emptyBoard, 'wsp', 'marketing')).toEqual([]);
  });
});

describe('cardMatchesQuery', () => {
  it('returns true for an empty query', () => {
    expect(cardMatchesQuery(makeCard(), '', emptyBoard)).toBe(true);
    expect(cardMatchesQuery(makeCard(), '   ', emptyBoard)).toBe(true);
  });

  describe('id search', () => {
    it('matches a full card id', () => {
      expect(cardMatchesQuery(makeCard(), 'a_sQiNQyD3', emptyBoard)).toBe(true);
    });

    it('matches a partial id substring', () => {
      expect(cardMatchesQuery(makeCard(), 'sqiNQy', emptyBoard)).toBe(true);
    });

    it('matches the id prefix', () => {
      expect(cardMatchesQuery(makeCard(), 'a_sqi', emptyBoard)).toBe(true);
    });

    it('does not match an unrelated id', () => {
      const card = makeCard({
        id: 'a_XYZ123',
        title: 'unrelated title',
        alias: 'unrelated-alias',
        description: undefined,
      });
      expect(cardMatchesQuery(card, 'sqinqy', emptyBoard)).toBe(false);
    });
  });

  describe('existing field behavior still works', () => {
    it('matches by title', () => {
      expect(cardMatchesQuery(makeCard(), 'include card', emptyBoard)).toBe(true);
    });

    it('matches by alias', () => {
      expect(cardMatchesQuery(makeCard(), 'omnibar-search', emptyBoard)).toBe(true);
    });

    it('matches by description', () => {
      expect(cardMatchesQuery(makeCard(), 'jump to a known', emptyBoard)).toBe(true);
    });

    it('matches by custom field value', () => {
      const card = makeCard({ type: 'feature', tags: ['ui', 'search'] });
      expect(cardMatchesQuery(card, 'feature', boardWithCustomFields)).toBe(true);
      expect(cardMatchesQuery(card, 'search', boardWithCustomFields)).toBe(true);
    });

    it('combines words with AND across fields', () => {
      // "feature" in custom field, "omnibar" in title
      const card = makeCard({ type: 'feature' });
      expect(cardMatchesQuery(card, 'feature omnibar', boardWithCustomFields)).toBe(true);
    });

    it('fails when one word matches nothing', () => {
      expect(cardMatchesQuery(makeCard(), 'omnibar nonexistentword', emptyBoard)).toBe(false);
    });
  });
});
