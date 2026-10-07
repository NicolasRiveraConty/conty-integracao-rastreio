import { describe, expect, it } from 'vitest';
import { assessDelay } from '../src/domain/delay';
import type { TrackingEvent } from '../src/domain/tracking-event';

const NOW = new Date('2026-10-07T15:00:00.000Z');
const LIMIT_HOURS = 72;

function event(partial: Pick<TrackingEvent, 'occurredAt' | 'status' | 'rawStatus'>): TrackingEvent {
  return {
    code: 'BR1',
    description: null,
    ...partial,
  };
}

describe('assessDelay com data controlada', () => {
  it('marca atraso quando o tempo desde a postagem passa do limite e o pacote não foi entregue', () => {
    const result = assessDelay(
      [
        event({ occurredAt: '2026-10-04T14:00:00.000Z', status: 'postado', rawStatus: 'POSTED' }),
        event({ occurredAt: '2026-10-05T14:00:00.000Z', status: 'em_transito', rawStatus: 'IN_TRANSIT' }),
      ],
      NOW,
      LIMIT_HOURS,
    );

    expect(result.delayed).toBe(true);
    expect(result.reason).toBe('acima_do_limite');
    expect(result.postedAt).toBe('2026-10-04T14:00:00.000Z');
    expect(result.elapsedHours).toBeGreaterThan(LIMIT_HOURS);
  });

  it('não marca atraso no instante exato do limite', () => {
    const result = assessDelay(
      [event({ occurredAt: '2026-10-04T15:00:00.000Z', status: 'postado', rawStatus: 'POSTED' })],
      NOW,
      LIMIT_HOURS,
    );

    expect(result.delayed).toBe(false);
    expect(result.reason).toBe('dentro_do_limite');
    expect(result.elapsedHours).toBe(72);
  });

  it('não marca entrega normal como atraso, mesmo depois do limite', () => {
    const result = assessDelay(
      [
        event({ occurredAt: '2026-10-01T15:00:00.000Z', status: 'postado', rawStatus: 'POSTED' }),
        event({ occurredAt: '2026-10-06T15:00:00.000Z', status: 'entregue', rawStatus: 'DELIVERED' }),
      ],
      NOW,
      LIMIT_HOURS,
    );

    expect(result.elapsedHours).toBeGreaterThan(LIMIT_HOURS);
    expect(result.delayed).toBe(false);
    expect(result.reason).toBe('entregue');
  });

  it('trata exceção e status desconhecido como não entregues', () => {
    const postedAt = '2026-10-01T15:00:00.000Z';

    const exception = assessDelay(
      [
        event({ occurredAt: postedAt, status: 'postado', rawStatus: 'POSTED' }),
        event({ occurredAt: '2026-10-02T15:00:00.000Z', status: 'excecao', rawStatus: 'HELD' }),
      ],
      NOW,
      LIMIT_HOURS,
    );
    const unknown = assessDelay(
      [
        event({ occurredAt: postedAt, status: 'postado', rawStatus: 'POSTED' }),
        event({ occurredAt: '2026-10-02T15:00:00.000Z', status: 'desconhecido', rawStatus: 'BANANA' }),
      ],
      NOW,
      LIMIT_HOURS,
    );

    expect(exception.delayed).toBe(true);
    expect(unknown.delayed).toBe(true);
  });

  it('não inventa atraso sem evento de postagem', () => {
    const result = assessDelay(
      [event({ occurredAt: '2026-10-01T15:00:00.000Z', status: 'em_transito', rawStatus: 'IN_TRANSIT' })],
      NOW,
      LIMIT_HOURS,
    );

    expect(result.delayed).toBe(false);
    expect(result.reason).toBe('sem_postagem');
  });

  it('usa a postagem mais antiga quando há mais de uma', () => {
    const result = assessDelay(
      [
        event({ occurredAt: '2026-10-06T15:00:00.000Z', status: 'postado', rawStatus: 'POSTED_AGAIN' }),
        event({ occurredAt: '2026-10-01T15:00:00.000Z', status: 'postado', rawStatus: 'POSTED' }),
        event({ occurredAt: '2026-10-06T16:00:00.000Z', status: 'em_transito', rawStatus: 'IN_TRANSIT' }),
      ],
      NOW,
      LIMIT_HOURS,
    );

    expect(result.postedAt).toBe('2026-10-01T15:00:00.000Z');
    expect(result.delayed).toBe(true);
  });
});
