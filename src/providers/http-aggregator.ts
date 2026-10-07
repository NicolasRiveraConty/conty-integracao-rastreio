import { mapRawStatus } from '../domain/map-status';
import type { TrackingEvent } from '../domain/tracking-event';
import { AggregatorError } from '../errors';
import type { TrackingProvider } from './tracking-provider';

interface AggregatorCheckpoint {
  timestamp?: unknown;
  status_code?: unknown;
  message?: unknown;
}

interface AggregatorPayload {
  checkpoints?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildTrackUrl(baseUrl: string, code: string): string {
  const withSlash = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(`v1/track/${encodeURIComponent(code)}`, withSlash).toString();
}

/** Isola o JSON do agregador fictício. Não use este formato fora do provider. */
export function parseAggregatorPayload(body: unknown, code: string): TrackingEvent[] {
  if (!isRecord(body) || !Array.isArray(body.checkpoints)) {
    throw new AggregatorError('Payload do agregador em formato inesperado.');
  }

  const payload = body as AggregatorPayload;
  const checkpoints = payload.checkpoints as unknown[];

  return checkpoints.map((checkpoint, index) => {
    if (!isRecord(checkpoint)) {
      throw new AggregatorError(`Checkpoint ${index} inválido.`);
    }

    const raw = checkpoint as AggregatorCheckpoint;
    if (typeof raw.timestamp !== 'string' || typeof raw.status_code !== 'string' || raw.status_code.trim() === '') {
      throw new AggregatorError(`Checkpoint ${index} sem timestamp ou status_code.`);
    }

    const occurredAtMs = Date.parse(raw.timestamp);
    if (Number.isNaN(occurredAtMs)) {
      throw new AggregatorError(`Checkpoint ${index} com timestamp inválido.`);
    }

    return {
      code,
      occurredAt: new Date(occurredAtMs).toISOString(),
      rawStatus: raw.status_code.trim(),
      status: mapRawStatus(raw.status_code),
      description: typeof raw.message === 'string' ? raw.message : null,
    };
  });
}

export interface HttpAggregatorOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class HttpAggregatorProvider implements TrackingProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: HttpAggregatorOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  async fetchTracking(code: string): Promise<TrackingEvent[]> {
    const url = buildTrackUrl(this.baseUrl, code);
    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new AggregatorError('Não foi possível consultar o agregador.', { cause: error });
    }

    if (!response.ok) {
      throw new AggregatorError(`Agregador respondeu HTTP ${response.status}.`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new AggregatorError('Resposta do agregador não é JSON.', { cause: error });
    }

    return parseAggregatorPayload(body, code);
  }
}
