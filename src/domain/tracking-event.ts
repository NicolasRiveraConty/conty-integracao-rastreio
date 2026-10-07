import type { NormalizedStatus } from './status';

export interface TrackingEvent {
  code: string;
  occurredAt: string;
  rawStatus: string;
  status: NormalizedStatus;
  description: string | null;
}

/** Chave de deduplicação: código + instante UTC + status bruto. */
export function eventKey(event: Pick<TrackingEvent, 'code' | 'occurredAt' | 'rawStatus'>): string {
  return `${event.code}|${event.occurredAt}|${event.rawStatus.trim().toUpperCase()}`;
}

export function compareEvents(
  a: Pick<TrackingEvent, 'occurredAt' | 'rawStatus'>,
  b: Pick<TrackingEvent, 'occurredAt' | 'rawStatus'>,
): number {
  const byTime = a.occurredAt.localeCompare(b.occurredAt);
  if (byTime !== 0) return byTime;
  return a.rawStatus.localeCompare(b.rawStatus);
}

export function dedupeEvents(events: readonly TrackingEvent[]): TrackingEvent[] {
  const seen = new Set<string>();
  const unique: TrackingEvent[] = [];

  for (const event of events) {
    const key = eventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...event });
  }

  return unique.sort(compareEvents);
}
