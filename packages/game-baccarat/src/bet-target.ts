export const BACCARAT_BET_IDS = ["player", "banker", "tie", "player_pair", "banker_pair"] as const;

export type BaccaratBetId = (typeof BACCARAT_BET_IDS)[number];

export type BaccaratBetTarget = BaccaratBetId;
