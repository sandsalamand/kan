import type { Card, BoardConfig } from '../api/types';

/**
 * Substring match: query must appear as a consecutive substring in target.
 * Case-insensitive.
 *
 * Examples:
 *   fuzzyMatch("bug", "fixing a bug") → true
 *   fuzzyMatch("fix", "prefix") → true
 *   fuzzyMatch("fg", "fixing a bug") → false (not consecutive)
 */
export function fuzzyMatch(query: string, target: string): boolean {
  return target.toLowerCase().includes(query.toLowerCase());
}

const ALNUM = /[a-zA-Z0-9]/;

/**
 * Positions in target where a word begins: the first character, anything after
 * a separator, a camelCase hump, and a digit that follows a letter. Computed on
 * the original casing so "WhatsApp" counts as two words.
 */
function wordStarts(target: string): number[] {
  const starts: number[] = [];
  for (let i = 0; i < target.length; i++) {
    const c = target[i];
    if (!ALNUM.test(c)) continue;
    if (i === 0) {
      starts.push(i);
      continue;
    }
    const prev = target[i - 1];
    const newWord =
      !ALNUM.test(prev) || // after a space, punctuation, dash...
      (c >= 'A' && c <= 'Z' && prev >= 'a' && prev <= 'z') || // camelCase hump
      (c >= '0' && c <= '9' && /[a-zA-Z]/.test(prev)); // v2, ws3
    if (newWord) starts.push(i);
  }
  return starts;
}

/**
 * Fuzzy match, the way editors do it. The query is matched as runs of
 * consecutive characters: the first run may start anywhere, and every later run
 * has to begin at a word boundary. Case-insensitive; an empty query matches.
 *
 * That one rule covers both things people expect a fuzzy search to do, while
 * leaving out the noise:
 *   fuzzyWordMatch("payout", "Tutor payout dashboard") → true (substring)
 *   fuzzyWordMatch("ayou", "Tutor payout dashboard") → true (mid-word is fine)
 *   fuzzyWordMatch("wsp", "Wise self-service payout") → true (word initials)
 *   fuzzyWordMatch("wisepay", "Wise self-service payout") → true (runs)
 *   fuzzyWordMatch("payout", "Salesperson when parents give") → false
 *   fuzzyWordMatch("fg", "fixing a bug") → false
 *
 * The last two are why runs are anchored to word boundaries: any short query is
 * a plain subsequence of almost any long-enough title, so unanchored matching
 * buries the cards you meant to find.
 */
export function fuzzyWordMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  if (q.length === 0) return true;
  if (q.length > target.length) return false;
  const t = target.toLowerCase();

  // Word starts grouped by their character, so continuing a match only
  // considers the handful of positions a new run could plausibly begin at.
  const startsByChar = new Map<string, number[]>();
  for (const p of wordStarts(target)) {
    const existing = startsByChar.get(t[p]);
    if (existing) {
      existing.push(p);
    } else {
      startsByChar.set(t[p], [p]);
    }
  }

  const width = t.length + 1;
  const memo = new Int8Array((q.length + 1) * width); // 0 unknown, 1 yes, 2 no

  // Can q[qi..] match t[ti..], given q[qi] may either extend the current run
  // (by sitting at ti) or open a new run at a word boundary further on?
  const canMatch = (qi: number, ti: number): boolean => {
    if (qi === q.length) return true;
    const key = qi * width + ti;
    if (memo[key] !== 0) return memo[key] === 1;

    let matched = ti < t.length && t[ti] === q[qi] && canMatch(qi + 1, ti + 1);
    if (!matched) {
      for (const p of startsByChar.get(q[qi]) ?? []) {
        if (p < ti) continue;
        if (canMatch(qi + 1, p + 1)) {
          matched = true;
          break;
        }
      }
    }

    memo[key] = matched ? 1 : 2;
    return matched;
  };

  // The first run may start anywhere, which is what keeps plain substrings
  // (including mid-word ones) matching.
  for (let p = 0; p < t.length; p++) {
    if (t[p] === q[0] && canMatch(1, p + 1)) return true;
  }
  return false;
}

/**
 * Check if a card matches a search query.
 * Searches: id, title, alias, description, and all custom field values.
 *
 * Query is split on whitespace into words. Each word must appear as a
 * consecutive substring (case-insensitive) in at least one field.
 * All words must match (AND logic), but can match different fields.
 *
 * Examples with query "fix bug":
 *   - "Bug fix for login" (title) → match
 *   - "Fixing a nasty bug" (title) → match
 *   - Title: "Fix login", Description: "Related to bug #123" → match
 *   - "f-i-x b-u-g" → no match
 */
export function cardMatchesQuery(card: Card, query: string, board: BoardConfig): boolean {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return true;

  // Build searchable texts from all fields
  const searchableTexts: string[] = [
    card.id.toLowerCase(),
    card.title.toLowerCase(),
    card.alias.toLowerCase(),
    card.description?.toLowerCase() ?? '',
  ];

  // Add custom field values
  if (board.custom_fields) {
    for (const fieldName of Object.keys(board.custom_fields)) {
      const value = card[fieldName];
      if (value == null) continue;
      if (Array.isArray(value)) {
        searchableTexts.push(...value.map((v) => String(v).toLowerCase()));
      } else {
        searchableTexts.push(String(value).toLowerCase());
      }
    }
  }

  // Each word must appear in at least one field
  return words.every((word) => searchableTexts.some((text) => text.includes(word)));
}

/**
 * Check if a card matches a search-bar query, fuzzily.
 *
 * Words are AND'd and may match different fields, same as cardMatchesQuery.
 * What differs is how one word matches a field:
 *
 *   - title, alias and custom field values match fuzzily (see fuzzyWordMatch),
 *     so "wsp" finds "Wise self-service payout"
 *   - id and description match by substring only. Ids are opaque — fuzzing
 *     them just produces coincidences — and descriptions are long enough that
 *     even boundary-anchored fuzzy matching gets loose.
 *
 * Examples with query "wsp":
 *   - "Wise self-service payout" (title) → match
 *   - "Payouts: switch provider" (title), description "…wsp…" → match
 *   - a card whose description merely mentions w…s…p across sentences → no match
 */
export function cardFuzzyMatchesQuery(card: Card, query: string, board: BoardConfig): boolean {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return true;

  // Fuzzy targets keep their original casing — fuzzyWordMatch reads camelCase
  // humps as word boundaries, and lowercasing first would erase them.
  const fuzzyTexts: string[] = [card.title, card.alias];
  const substringTexts: string[] = [card.id.toLowerCase(), card.description?.toLowerCase() ?? ''];

  if (board.custom_fields) {
    for (const fieldName of Object.keys(board.custom_fields)) {
      const value = card[fieldName];
      if (value == null) continue;
      if (Array.isArray(value)) {
        fuzzyTexts.push(...value.map((v) => String(v)));
      } else {
        fuzzyTexts.push(String(value));
      }
    }
  }

  return words.every(
    (word) =>
      fuzzyTexts.some((text) => fuzzyWordMatch(word, text)) ||
      substringTexts.some((text) => text.includes(word))
  );
}

/**
 * Apply the board's card filters: the header search bar (fuzzy) and the
 * omnibar's query (substring). Both narrow the same set, so a card has to
 * satisfy whichever of them is non-empty. Used by both the board itself and
 * the omnibar's keyboard navigation so the two never disagree about what's
 * on screen.
 */
export function filterCards(
  cards: Card[],
  board: BoardConfig,
  searchQuery: string,
  omnibarQuery: string
): Card[] {
  const search = searchQuery.trim();
  const omnibar = omnibarQuery.trim();
  let result = cards;
  if (search) {
    result = result.filter((card) => cardFuzzyMatchesQuery(card, search, board));
  }
  if (omnibar) {
    result = result.filter((card) => cardMatchesQuery(card, omnibar, board));
  }
  return result;
}
