import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { EpicGroupNode } from '../utils/epicGroups';
import { EPIC_DROP_PREFIX, EPIC_MOUTH_PREFIX, epicColor, epicDropId } from '../utils/epicGroups';
import { useCompactMode } from '../contexts/CompactModeContext';
import { useEpicMode } from '../contexts/EpicModeContext';

/** hex color at the given alpha, for the block's washed body. */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface EpicGroupProps {
  node: EpicGroupNode;
  /** Column this block is rendered in — a drop here moves the card here too. */
  column: string;
  /** The epic's own card, rendered as the group's head. Absent for headless groups. */
  head?: ReactNode;
  /** The group's member cards (and nested groups). */
  children: ReactNode;
  /** True while a card is being dragged — turns the header into a visible drop target. */
  isDragActive?: boolean;
  /** Opens the epic's card. Used for headless groups, whose card is in another column. */
  onOpenEpic?: () => void;
}

/**
 * A Scratch C-block for an epic: the epic's card sits in the "hat", its members
 * hang inside the "mouth" behind a colored spine, and the foot closes the shape.
 * The color is derived from the epic's card ID, so the same epic reads as the
 * same block in every column it touches.
 *
 * Dropping a card on the hat makes it a member of the epic (see Board.tsx).
 */
export default function EpicGroup({ node, column, head, children, isDragActive, onOpenEpic }: EpicGroupProps) {
  const { isCompact } = useCompactMode();
  const { collapsedEpics, toggleEpicCollapsed } = useEpicMode();

  const color = epicColor(node.epicId);
  const isCollapsed = !!collapsedEpics[node.epicId];
  const title = node.epic?.title ?? 'Epic';

  const { setNodeRef: setHatRef, isOver: isOverHat } = useDroppable({
    id: epicDropId(EPIC_DROP_PREFIX, column, node.epicId),
  });
  const { setNodeRef: setMouthRef, isOver: isOverMouth } = useDroppable({
    id: epicDropId(EPIC_MOUTH_PREFIX, column, node.epicId),
  });
  const isOver = isOverHat || isOverMouth;

  const spineWidth = isCompact ? 8 : 10;
  const well = isCompact ? 'p-1 space-y-1' : 'p-1.5 space-y-1.5';

  return (
    <div
      className={`rounded-lg shadow-sm transition-shadow ${isOver ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-gray-200 dark:ring-offset-gray-800' : ''}`}
      // Solid hat and spine, washed body: the C-block shape stays legible while
      // several nested epics on one board stay quiet enough to read past.
      style={{ backgroundColor: withAlpha(color, 0.16), boxShadow: `inset 0 0 0 1px ${withAlpha(color, 0.45)}` }}
      data-epic-id={node.epicId}
    >
      {/* Hat — collapse control, epic identity, member count, drop target */}
      <div
        ref={setHatRef}
        style={{ backgroundColor: color }}
        className="flex items-center gap-1 px-1.5 h-6 rounded-t-lg text-white select-none"
        title={
          isDragActive
            ? `Drop here to add the card to "${title}"`
            : `Epic: ${title}`
        }
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleEpicCollapsed(node.epicId);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-0.5 -ml-0.5 rounded hover:bg-black/20"
          title={isCollapsed ? 'Expand epic' : 'Collapse epic'}
          aria-label={isCollapsed ? 'Expand epic' : 'Collapse epic'}
        >
          <svg
            className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {isOver ? (
          <span className="text-[11px] font-semibold">Add to epic</span>
        ) : node.head ? (
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Epic</span>
        ) : (
          // Headless group: the epic's card lives in another column, so name it
          // here and let a click jump to it.
          <button
            onClick={onOpenEpic}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1 min-w-0 text-left hover:underline"
            title={`Open "${title}" (in ${node.epicColumn})`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-90 flex-shrink-0">Epic</span>
            <span className="text-[11px] font-medium truncate">{title}</span>
            {node.epicColumn && (
              <span className="text-[10px] opacity-75 flex-shrink-0">↗ {node.epicColumn}</span>
            )}
          </button>
        )}

        <span className="flex-1" />

        <span className="text-[10px] font-semibold px-1.5 rounded-full bg-black/20 flex-shrink-0">
          {isCollapsed ? `${node.count} hidden` : node.count}
        </span>
      </div>

      {/* Head — the epic's own card, framed by the block color. Stays visible
          when collapsed: it's a real card in this column, only its members hide. */}
      {head && <div className="px-[3px]">{head}</div>}

      {/* Mouth — members sit in a cut-out behind the spine */}
      {!isCollapsed && (
        <div style={{ borderLeft: `${spineWidth}px solid ${color}` }} className="pr-[3px] pt-[3px] pl-[3px]">
          <div
            ref={setMouthRef}
            className={`rounded-md ${well} ${
              isOver ? 'outline outline-2 outline-dashed outline-blue-500' : ''
            }`}
          >
            {children}
          </div>
        </div>
      )}

      {/* Foot — closes the C */}
      <div
        className={isCollapsed ? 'h-1' : 'h-2.5'}
        style={{ borderLeft: `${spineWidth}px solid ${color}`, borderBottomLeftRadius: 8 }}
      />
    </div>
  );
}
