import type { BoardConfig, Card, UpdateCardInput } from '../api/types';
import { FIELD_TYPE_ENUM_SET, FIELD_TYPE_FREE_SET } from '../api/types';
import { toApiFieldValues } from './customFields';

/**
 * Fields the user has edited in the card modal. An absent key means the field
 * was never touched, which is the important distinction: the modal saves when
 * it closes, so anything it doesn't know was edited must not be written back.
 * Otherwise a card that changed underneath the open modal (a git branch switch,
 * another client, an edit on disk) gets reverted on close — kan issue #12.
 */
export interface CardEdits {
  title?: string;
  description?: string;
  column?: string;
  parent?: string;
  customFields?: Record<string, unknown>;
}

/**
 * Builds the update payload for a card: the edited fields that still differ
 * from the card as it stands right now. Returns null when there is nothing to
 * save, so callers can skip the request entirely.
 */
export function buildCardUpdate(
  card: Card,
  edits: CardEdits,
  boardFields?: BoardConfig['custom_fields'],
): UpdateCardInput | null {
  const updates: UpdateCardInput = {};

  if (edits.title !== undefined && edits.title.trim() !== card.title) {
    updates.title = edits.title.trim();
  }
  if (edits.description !== undefined && edits.description.trim() !== (card.description ?? '')) {
    updates.description = edits.description.trim();
  }
  if (edits.column !== undefined && edits.column !== card.column) {
    updates.column = edits.column;
  }
  // "" is a real value here (it clears the parent), so compare, don't truthy-check.
  if (edits.parent !== undefined && edits.parent !== (card.parent ?? '')) {
    updates.parent = edits.parent;
  }

  if (edits.customFields && boardFields) {
    const changed: Record<string, unknown> = {};

    for (const [fieldName, value] of Object.entries(edits.customFields)) {
      const schema = boardFields[fieldName];
      if (!schema) continue; // field removed from the board since the modal opened
      const originalValue = card[fieldName];

      if (schema.type === FIELD_TYPE_ENUM_SET || schema.type === FIELD_TYPE_FREE_SET) {
        const original = Array.isArray(originalValue) ? [...originalValue].sort() : [];
        const current = Array.isArray(value) ? [...(value as unknown[])].sort() : [];
        if (JSON.stringify(original) === JSON.stringify(current)) continue;
      } else if (originalValue === value) {
        continue;
      }

      changed[fieldName] = value;
    }

    if (Object.keys(changed).length > 0) {
      const apiFields = toApiFieldValues(changed, boardFields);
      if (Object.keys(apiFields).length > 0) updates.custom_fields = apiFields;
    }
  }

  return Object.keys(updates).length > 0 ? updates : null;
}
