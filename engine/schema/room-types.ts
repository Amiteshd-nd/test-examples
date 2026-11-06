import { z } from 'zod';

// PRD P1.1 task 3 plus the founder's additions (dress, family lounge, lift, shop/office; D-12).
// Order is the order shown to users; ids are stored and never renamed.
export const ROOM_TYPES = [
  { id: 'living', label: 'Living' },
  { id: 'family_lounge', label: 'Family lounge' },
  { id: 'dining', label: 'Dining' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'master_bedroom', label: 'Master bedroom' },
  { id: 'dress', label: 'Dress / walk-in' },
  { id: 'toilet', label: 'Toilet (bath + WC)' },
  { id: 'bath', label: 'Bath' },
  { id: 'wc', label: 'WC' },
  { id: 'pooja', label: 'Pooja' },
  { id: 'utility', label: 'Utility' },
  { id: 'store', label: 'Store' },
  { id: 'staircase', label: 'Staircase' },
  { id: 'lift', label: 'Lift' },
  { id: 'sit_out', label: 'Sit-out' },
  { id: 'balcony', label: 'Balcony' },
  { id: 'parking', label: 'Parking' },
  { id: 'ots', label: 'Open to sky (OTS)' },
  { id: 'study', label: 'Study' },
  { id: 'foyer', label: 'Foyer' },
  { id: 'passage', label: 'Passage' },
  { id: 'servant', label: "Servant's room" },
  { id: 'duct', label: 'Duct' },
  { id: 'shop_office', label: 'Shop / office' },
] as const;

export type RoomTypeId = (typeof ROOM_TYPES)[number]['id'];

const ids = ROOM_TYPES.map((t) => t.id) as [RoomTypeId, ...RoomTypeId[]];

export const RoomType = z.enum(ids);
export type RoomType = z.infer<typeof RoomType>;

export function roomTypeLabel(id: RoomTypeId): string {
  return ROOM_TYPES.find((t) => t.id === id)?.label ?? id;
}
