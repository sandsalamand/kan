import { useEffect, useRef } from 'react';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** Cards matching the query (equals totalCount when the query is empty). */
  matchCount: number;
  totalCount: number;
  /**
   * When false the "/" focus shortcut is ignored — set while something else
   * owns the keyboard (the omnibar, a card modal).
   */
  shortcutEnabled?: boolean;
}

export default function SearchBar({
  query,
  onQueryChange,
  matchCount,
  totalCount,
  shortcutEnabled = true,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search bar. Ignored while the user is typing anywhere
  // else, so a slash stays a literal slash in inputs, textareas and the
  // omnibar's own slash commands.
  useEffect(() => {
    if (!shortcutEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target?.isContentEditable) return;

      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcutEnabled]);

  const isFiltering = query.trim().length > 0;

  return (
    <div className="relative w-full max-w-sm">
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            // First Escape clears a query, a second one gives the board back
            // the keyboard (number shortcuts, ⌘C/⌘E/⌘J).
            if (query) {
              onQueryChange('');
            } else {
              inputRef.current?.blur();
            }
          }
        }}
        placeholder="Search cards..."
        aria-label="Search cards"
        className="w-full border border-gray-300 dark:border-gray-600 rounded-md pl-8 pr-20 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isFiltering ? (
          <>
            <span
              className={`text-xs tabular-nums ${
                matchCount === 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
              }`}
              title={`${matchCount} of ${totalCount} cards match`}
            >
              {matchCount}/{totalCount}
            </span>
            <button
              onClick={() => {
                onQueryChange('');
                inputRef.current?.focus();
              }}
              title="Clear search (Esc)"
              aria-label="Clear search"
              className="p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] leading-none font-medium text-gray-400 dark:text-gray-500 border border-gray-300 dark:border-gray-600 rounded pointer-events-none">
            /
          </kbd>
        )}
      </div>
    </div>
  );
}
