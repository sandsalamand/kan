import { useEpicMode } from '../contexts/EpicModeContext';

export default function EpicToggle() {
  const { isGrouped, toggleGrouped } = useEpicMode();

  return (
    <button
      onClick={toggleGrouped}
      className={`p-2 rounded-md ${
        isGrouped
          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700'
      }`}
      title={isGrouped ? 'Epic grouping on (⌘E)' : 'Group cards by epic (⌘E)'}
      aria-label="Toggle epic grouping"
    >
      {/* Bracket around nested items — the C-block shape in miniature */}
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H5v16h3" />
        <path strokeLinecap="round" strokeWidth={2} d="M11 9h8M11 15h8" />
      </svg>
    </button>
  );
}
