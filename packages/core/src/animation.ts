export type AnimationStyle =
  | "none"
  | "flash"
  | "burst"
  | "sweep"
  | "banner"
  | "particles"
  | "trail"
  | "dragon"
  | "shake"
  | "spin"
  | "chips";

export interface AnimationPreset {
  enabled: boolean;
  style: AnimationStyle;
  durationMs: number;
  intensity: 1 | 2 | 3;
  color?: string;
  text?: string;
  sound?: string | null;
  soundVolume: number;
  blockBoardUpdate: boolean;
}

export interface AnimationEventDef {
  id: string;
  label: string;
  defaultPreset: AnimationPreset;
  layered?: boolean;
}

export interface AnimationTrigger {
  eventId: string;
  vars: Record<string, string | number>;
  anchor?: { x: number; y: number };
  path?: { x: number; y: number }[];
}
