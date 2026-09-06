/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

/**
 * Epic grouping: render cards that share a `parent` inside one Scratch-style
 * container instead of scattering them through the column. Global preference
 * (not per board) plus the set of collapsed epics, both in localStorage.
 */
interface EpicModeContextValue {
  isGrouped: boolean;
  toggleGrouped: () => void;
  collapsedEpics: Record<string, boolean>;
  toggleEpicCollapsed: (epicId: string) => void;
}

const EpicModeContext = createContext<EpicModeContextValue | null>(null);

const GROUPING_KEY = 'kan-epic-grouping';
const COLLAPSED_KEY = 'kan-epic-collapsed';

function getStoredGrouping(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    // Default on: an ungrouped board is what the toggle is there to show.
    return localStorage.getItem(GROUPING_KEY) !== 'false';
  } catch {
    return true;
  }
}

function getStoredCollapsed(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function EpicModeProvider({ children }: { children: ReactNode }) {
  const [isGrouped, setIsGrouped] = useState<boolean>(getStoredGrouping);
  const [collapsedEpics, setCollapsedEpics] = useState<Record<string, boolean>>(getStoredCollapsed);

  const toggleGrouped = useCallback(() => {
    setIsGrouped((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(GROUPING_KEY, String(next));
      } catch {
        // Safari private browsing or storage-restricted environments
      }
      return next;
    });
  }, []);

  const toggleEpicCollapsed = useCallback((epicId: string) => {
    setCollapsedEpics((prev) => {
      const next = { ...prev, [epicId]: !prev[epicId] };
      if (!next[epicId]) delete next[epicId]; // don't accumulate false entries
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // Safari private browsing or storage-restricted environments
      }
      return next;
    });
  }, []);

  return (
    <EpicModeContext.Provider value={{ isGrouped, toggleGrouped, collapsedEpics, toggleEpicCollapsed }}>
      {children}
    </EpicModeContext.Provider>
  );
}

export function useEpicMode() {
  const context = useContext(EpicModeContext);
  if (!context) {
    throw new Error('useEpicMode must be used within an EpicModeProvider');
  }
  return context;
}
