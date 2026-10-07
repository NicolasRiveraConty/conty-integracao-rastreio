import { compareEvents, type TrackingEvent } from './tracking-event';

export type DelayReason =
  | 'sem_eventos'
  | 'sem_postagem'
  | 'entregue'
  | 'dentro_do_limite'
  | 'acima_do_limite';

export interface DelayAssessment {
  delayed: boolean;
  reason: DelayReason;
  postedAt: string | null;
  elapsedHours: number | null;
}

const HOUR_MS = 60 * 60 * 1000;

type DelayEvent = Pick<TrackingEvent, 'occurredAt' | 'status' | 'rawStatus'>;

/**
 * Atraso só existe para pacote que ainda não foi entregue.
 * A contagem começa no evento "postado" mais antigo e passa do limite
 * quando as horas decorridas são estritamente maiores que o configurado.
 * Entrega normal, mesmo tardia, não é atraso: o pacote já chegou.
 */
export function assessDelay(
  events: readonly DelayEvent[],
  now: Date,
  thresholdHours: number,
): DelayAssessment {
  if (events.length === 0) {
    return { delayed: false, reason: 'sem_eventos', postedAt: null, elapsedHours: null };
  }

  const ordered = [...events].sort(compareEvents);
  const latest = ordered.at(-1);
  if (!latest) {
    return { delayed: false, reason: 'sem_eventos', postedAt: null, elapsedHours: null };
  }

  const postedAt = ordered.find((event) => event.status === 'postado')?.occurredAt ?? null;
  const elapsedHours = postedAt === null ? null : (now.getTime() - Date.parse(postedAt)) / HOUR_MS;

  if (latest.status === 'entregue') {
    return { delayed: false, reason: 'entregue', postedAt, elapsedHours };
  }

  if (postedAt === null || elapsedHours === null) {
    return { delayed: false, reason: 'sem_postagem', postedAt: null, elapsedHours: null };
  }

  if (elapsedHours > thresholdHours) {
    return { delayed: true, reason: 'acima_do_limite', postedAt, elapsedHours };
  }

  return { delayed: false, reason: 'dentro_do_limite', postedAt, elapsedHours };
}
