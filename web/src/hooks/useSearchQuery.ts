import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const SEARCH_PARAM = 'q';

/**
 * The board's search-bar query, held in React state and mirrored into the URL
 * (?q=) so a filtered board survives a reload and can be shared as a link.
 *
 * State is local first and the URL second, deliberately. React Router commits
 * a navigation asynchronously, so an input controlled straight off the search
 * params re-renders with the *old* value between keystrokes and drops
 * characters when someone types quickly. The search bar owns the query; the
 * URL follows it.
 *
 * The URL is read on mount, so a shared or reloaded link starts out filtered.
 * After that, writes only go the other way — the sync effect rewrites ?q= from
 * state, which is what restores it after a navigation that drops the query
 * string (switching boards) but also means the back button won't step through
 * queries. Fine, because those writes replace rather than push: typing never
 * put those entries in the history to begin with.
 */
export function useSearchQuery(): [string, (query: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get(SEARCH_PARAM) ?? '');
  const urlQuery = searchParams.get(SEARCH_PARAM) ?? '';

  useEffect(() => {
    if (urlQuery === query) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (query) {
          next.set(SEARCH_PARAM, query);
        } else {
          next.delete(SEARCH_PARAM);
        }
        return next;
      },
      { replace: true }
    );
  }, [query, urlQuery, setSearchParams]);

  return [query, setQuery];
}
