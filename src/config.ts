export interface AppConfig {
  port: number;
  host: string;
  aggregatorBaseUrl: string;
  delayThresholdHours: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 3000);
  const delayThresholdHours = Number(env.DELAY_THRESHOLD_HOURS ?? 72);
  const aggregatorBaseUrl = env.AGGREGATOR_BASE_URL ?? 'http://127.0.0.1:4000';

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT inválida.');
  }
  if (!Number.isFinite(delayThresholdHours) || delayThresholdHours < 0) {
    throw new Error('DELAY_THRESHOLD_HOURS deve ser um número >= 0.');
  }
  if (aggregatorBaseUrl.trim() === '') {
    throw new Error('AGGREGATOR_BASE_URL vazia.');
  }

  return {
    port,
    host: env.HOST ?? '127.0.0.1',
    aggregatorBaseUrl,
    delayThresholdHours,
  };
}
