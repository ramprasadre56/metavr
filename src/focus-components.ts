import { createComponent, Types } from '@iwsdk/core';

/** A task card on the spatial kanban board. */
export const TaskCard = createComponent('TaskCard', {
  cardId: { type: Types.Int32, default: 0 },
  column: { type: Types.Int8, default: 0, min: 0, max: 2 },
});

/** A pressable control on the desk (orb, buttons). */
export const DeskButton = createComponent('DeskButton', {
  action: { type: Types.String, default: '' },
});
