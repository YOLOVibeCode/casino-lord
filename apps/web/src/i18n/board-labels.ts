import type { BoardLanguage } from "../settings/device-settings.js";

const LABELS: Record<string, { en: string; zh: string }> = {
  "Bead Plate": { en: "Bead Plate", zh: "珠盘" },
  "Big Road": { en: "Big Road", zh: "大路" },
  "Big Eye Boy": { en: "Big Eye Boy", zh: "大眼仔" },
  "Small Road": { en: "Small Road", zh: "小路" },
  "Cockroach Pig": { en: "Cockroach Pig", zh: "蟑螂路" },
  Player: { en: "Player", zh: "闲" },
  Banker: { en: "Banker", zh: "庄" },
  Tie: { en: "Tie", zh: "和" },
  "Player %": { en: "Player %", zh: "闲 %" },
  "Banker %": { en: "Banker %", zh: "庄 %" },
  "Player pairs": { en: "Player pairs", zh: "闲对" },
  "Banker pairs": { en: "Banker pairs", zh: "庄对" },
  Red: { en: "Red", zh: "红" },
  Black: { en: "Black", zh: "黑" },
  Green: { en: "Green", zh: "绿" },
  Odd: { en: "Odd", zh: "单" },
  Even: { en: "Even", zh: "双" },
  Low: { en: "Low", zh: "小" },
  High: { en: "High", zh: "大" },
  "1st 12": { en: "1st 12", zh: "第一打" },
  "2nd 12": { en: "2nd 12", zh: "第二打" },
  "3rd 12": { en: "3rd 12", zh: "第三打" },
  "COL 1": { en: "COL 1", zh: "列1" },
  "COL 2": { en: "COL 2", zh: "列2" },
  "COL 3": { en: "COL 3", zh: "列3" },
  HOT: { en: "HOT", zh: "热" },
  COLD: { en: "COLD", zh: "冷" },
  LAST: { en: "LAST", zh: "最近" },
};

export function formatBoardLabel(key: string, language: BoardLanguage): string {
  const entry = LABELS[key];
  if (!entry) return key;

  switch (language) {
    case "EN":
      return entry.en;
    case "ZH":
      return entry.zh;
    case "EN+ZH":
      return `${entry.en} / ${entry.zh}`;
  }
}
