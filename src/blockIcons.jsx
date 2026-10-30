import { Coffee, DoorOpen, Presentation, ClipboardCheck, Trophy, Sandwich, Footprints } from 'lucide-react';

/**
 * Custom icon for a jump rope, drawn as a smooth curved arc between two
 * grip handles — lucide has no rope icon, and the user wants a rounded,
 * non-angular shape rather than a geometric substitute.
 * Props mirror the lucide-react icon API (size/color/strokeWidth) so it
 * drops in anywhere a lucide icon is used.
 */
export function JumpRopeIcon({ size = 24, color = 'currentColor', strokeWidth = 2, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <rect x="3" y="15" width="3" height="6" rx="1.5" />
      <rect x="18" y="15" width="3" height="6" rx="1.5" />
      <path d="M6 15c0-7.5 3-11 6-11s6 3.5 6 11" />
    </svg>
  );
}

/** Registry of selectable block icons, keyed for storage on `block.icon`. */
export const BLOCK_ICON_OPTIONS = [
  { key: 'coffee', label: 'Koffie', Icon: Coffee },
  { key: 'door-open', label: 'Deur open', Icon: DoorOpen },
  { key: 'presentation', label: 'Jurybriefing', Icon: Presentation },
  { key: 'clipboard-check', label: 'Proefjury', Icon: ClipboardCheck },
  { key: 'trophy', label: 'Trofee', Icon: Trophy },
  { key: 'sandwich', label: 'Broodje', Icon: Sandwich },
  { key: 'footprints', label: 'Sportschoen', Icon: Footprints },
  { key: 'jump-rope', label: 'Springtouw', Icon: JumpRopeIcon },
];

const ICON_BY_KEY = Object.fromEntries(BLOCK_ICON_OPTIONS.map((o) => [o.key, o.Icon]));

/** Default icon key per non-heats block type. */
export const DEFAULT_ICON_BY_BLOCK_TYPE = {
  pauze: 'coffee',
  lunchpauze: 'sandwich',
  deuren: 'door-open',
  briefing: 'presentation',
  proefjury: 'clipboard-check',
  prijsuitreiking: 'trophy',
};

/** Default icon key for heats blocks, based on the resolved event's scoringType. */
export const DEFAULT_ICON_BY_SCORING_TYPE = {
  speed: 'footprints',
  freestyle: 'jump-rope',
};

/**
 * Resolves which icon key to render for a block: an explicit `block.icon`
 * override wins, otherwise a computed default based on block.type (or, for
 * heats blocks, the resolved event's scoringType), falling back to 'coffee'.
 * @param {object} block
 * @param {object} [event] the event resolved via block.eventId, for heats blocks
 */
export function resolveBlockIconKey(block, event) {
  if (block?.icon) return block.icon;
  if (block?.type === 'heats') {
    return DEFAULT_ICON_BY_SCORING_TYPE[event?.scoringType] ?? 'coffee';
  }
  return DEFAULT_ICON_BY_BLOCK_TYPE[block?.type] ?? 'coffee';
}

/** Returns the icon component for a given icon key, falling back to Coffee. */
export function getBlockIcon(key) {
  return ICON_BY_KEY[key] ?? Coffee;
}
