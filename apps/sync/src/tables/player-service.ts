import {
  isValidPlayerColor,
  validatePlayerName,
  type Player,
  type TableEvent,
} from "@casino-lord/core";
import { randomUUID } from "node:crypto";
import type { Config } from "../config.js";
import type { PlayerRow, TableRepository } from "../persistence/repository.js";
import { generatePlayerToken, hashToken, verifyToken } from "./token.js";
import type { TableInstance } from "./table-instance.js";

export interface JoinPlayerResult {
  playerId: string;
  playerToken: string;
  pending: boolean;
  event?: TableEvent;
}

export type AdmitPlayerResult =
  | {
      ok: true;
      event?: TableEvent;
      declined?: boolean;
    }
  | {
      ok: false;
      error: "NOT_FOUND" | "NOT_PENDING";
    };

export class PlayerService {
  constructor(
    private readonly config: Config,
    private readonly repository: TableRepository,
  ) {}

  joinPlayer(
    table: TableInstance,
    name: string,
    color: string,
    at: string,
  ):
    | JoinPlayerResult
    | {
        error:
          | "INVALID_NAME"
          | "INVALID_COLOR"
          | "JOINING_CLOSED"
          | "TABLE_FULL"
          | "PLAYERS_DISABLED"
          | "SESSION_ENDED";
      } {
    if (!this.config.enablePlayerMode) {
      return { error: "PLAYERS_DISABLED" };
    }

    const composed = table.getComposed();
    if (composed.platform.participation.playerMode !== "on") {
      return { error: "PLAYERS_DISABLED" };
    }

    if (table.sessionEnded) {
      return { error: "SESSION_ENDED" };
    }

    if (!composed.platform.settings.players.joiningOpen) {
      return { error: "JOINING_CLOSED" };
    }

    const nameResult = validatePlayerName(name);
    if (!nameResult.ok) {
      return { error: "INVALID_NAME" };
    }

    if (!isValidPlayerColor(color)) {
      return { error: "INVALID_COLOR" };
    }

    const maxPlayers = Math.min(
      composed.platform.settings.players.maxPlayers,
      this.config.maxPlayersHard,
    );
    const pendingCount = this.repository
      .getPlayersByCode(table.code)
      .filter((p) => p.pending).length;
    if (table.activePlayerCount() + pendingCount >= maxPlayers) {
      return { error: "TABLE_FULL" };
    }

    const playerId = randomUUID();
    const playerToken = generatePlayerToken();
    const tokenHash = hashToken(playerToken);
    const joinApproval = composed.platform.settings.players.joinApproval;

    const row: PlayerRow = {
      code: table.code,
      playerId,
      name: nameResult.name,
      color,
      tokenHash,
      joinedAt: at,
      pending: joinApproval,
    };
    this.repository.savePlayer(row);

    if (joinApproval) {
      return { playerId, playerToken, pending: true };
    }

    const player: Player = {
      id: playerId,
      name: nameResult.name,
      color,
      status: "active",
      joinedAt: at,
    };

    const appended = table.appendEvent(
      { type: "PLAYER_JOINED", player } as Omit<TableEvent, "seq" | "at">,
      `server-join-${playerId}`,
      at,
    );
    if (appended.kind !== "new") {
      throw new Error("unexpected duplicate on player join");
    }

    this.repository.setPlayerPending(table.code, playerId, false);
    return { playerId, playerToken, pending: false, event: appended.event };
  }

  verifyPlayerToken(table: TableInstance, token: string): PlayerRow | null {
    const hash = hashToken(token);
    return this.repository.findPlayerByTokenHash(table.code, hash);
  }

  getPendingPlayers(code: string): PlayerRow[] {
    return this.repository.getPlayersByCode(code).filter((p) => p.pending);
  }

  pendingPayload(code: string): Array<{ id: string; name: string; color: string }> {
    return this.getPendingPlayers(code).map((p) => ({
      id: p.playerId,
      name: p.name,
      color: p.color,
    }));
  }

  admitPlayer(
    table: TableInstance,
    playerId: string,
    accept: boolean,
    at: string,
  ): AdmitPlayerResult {
    const row = this.repository.getPlayer(table.code, playerId);
    if (!row) {
      return { ok: false, error: "NOT_FOUND" };
    }
    if (!row.pending) {
      return { ok: false, error: "NOT_PENDING" };
    }

    if (!accept) {
      this.repository.deletePlayer(table.code, playerId);
      return { ok: true, declined: true };
    }

    const player: Player = {
      id: row.playerId,
      name: row.name,
      color: row.color,
      status: "active",
      joinedAt: row.joinedAt,
    };

    const appended = table.appendEvent(
      { type: "PLAYER_JOINED", player } as Omit<TableEvent, "seq" | "at">,
      `server-admit-${playerId}`,
      at,
    );
    if (appended.kind !== "new") {
      throw new Error("unexpected duplicate on player admit");
    }

    this.repository.setPlayerPending(table.code, playerId, false);
    return { ok: true, event: appended.event };
  }

  reissueToken(table: TableInstance, playerId: string): { playerToken: string } | null {
    const row = this.repository.getPlayer(table.code, playerId);
    if (!row || row.pending) {
      return null;
    }
    const playerToken = generatePlayerToken();
    this.repository.updatePlayerToken(table.code, playerId, hashToken(playerToken));
    return { playerToken };
  }
}

export function verifyPlayerTokenRow(token: string, row: PlayerRow): boolean {
  return verifyToken(token, row.tokenHash);
}
