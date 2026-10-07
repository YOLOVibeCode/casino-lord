const SERVICE_NAME = "casino-lord" as const;

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveHealthCommit(env: NodeJS.ProcessEnv = process.env): string {
  return nonEmpty(env.RAILWAY_GIT_COMMIT_SHA) ?? nonEmpty(env.GIT_COMMIT) ?? "unknown";
}

export function resolveHealthEnv(env: NodeJS.ProcessEnv = process.env): string {
  return nonEmpty(env.APP_ENV) ?? nonEmpty(env.RAILWAY_ENVIRONMENT_NAME) ?? "dev";
}

export interface BuildHealthPayloadOptions {
  startedAtMs: number;
  enableVirtual: boolean;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}

export interface HealthPayload {
  ok: true;
  uptimeSeconds: number;
  enableVirtual: boolean;
  service: typeof SERVICE_NAME;
  commit: string;
  env: string;
  utc: string;
}

export function buildHealthPayload(options: BuildHealthPayloadOptions): HealthPayload {
  const now = options.now ?? new Date();
  const env = options.env ?? process.env;
  return {
    ok: true,
    uptimeSeconds: Math.floor((now.getTime() - options.startedAtMs) / 1000),
    enableVirtual: options.enableVirtual,
    service: SERVICE_NAME,
    commit: resolveHealthCommit(env),
    env: resolveHealthEnv(env),
    utc: now.toISOString(),
  };
}
