import { describe, expect, it } from 'vitest';
import { dedupeEvents, eventKey, type TrackingEvent } from '../src/domain/tracking-event';
import { MemoryShipmentRepository } from '../src/persistence/shipment-repository';

function event(overrides: Partial<TrackingEvent> = {}): TrackingEvent {
  return {
    code: 'BR1',
    occurredAt: '2026-10-01T12:00:00.000Z',
    rawStatus: 'POSTED',
    status: 'postado',
    description: 'Objeto postado',
    ...overrides,
  };
}

describe('histórico deduplicado', () => {
  it('usa a chave código + timestamp + status bruto', () => {
    const base = event();
    const sameInstantAndRawStatus = event({ description: 'outra descrição', status: 'em_transito' });
    expect(eventKey(base)).toBe(eventKey(sameInstantAndRawStatus));
    expect(eventKey(base)).not.toBe(eventKey(event({ rawStatus: 'IN_TRANSIT', status: 'em_transito' })));
    expect(eventKey(base)).not.toBe(eventKey(event({ occurredAt: '2026-10-02T12:00:00.000Z' })));
    expect(eventKey(base)).not.toBe(eventKey(event({ code: 'BR2' })));
  });

  it('ignora o mesmo evento repetido e preserva status bruto diferente no mesmo instante', () => {
    const posted = event();
    const again = event({ description: 'repetido' });
    const moved = event({
      occurredAt: '2026-10-01T12:00:00.000Z',
      rawStatus: 'IN_TRANSIT',
      status: 'em_transito',
      description: 'Saiu da origem',
    });

    const unique = dedupeEvents([posted, again, moved, { ...posted, rawStatus: 'posted' }]);

    expect(unique).toHaveLength(2);
    expect(unique.find((item) => item.rawStatus === 'POSTED')?.description).toBe('Objeto postado');
    expect(unique.map((item) => item.status)).toEqual(['em_transito', 'postado']);
  });

  it('não duplica ao consultar de novo e não apaga evento que sumiu da resposta nova', () => {
    const repository = new MemoryShipmentRepository();
    const first = event();
    const second = event({
      occurredAt: '2026-10-02T12:00:00.000Z',
      rawStatus: 'IN_TRANSIT',
      status: 'em_transito',
      description: 'Em trânsito',
    });

    repository.upsert('BR1', '2026-10-07T00:00:00.000Z', [first, second]);
    const refreshed = repository.upsert('BR1', '2026-10-08T00:00:00.000Z', [first, second]);
    const partial = repository.upsert('BR1', '2026-10-09T00:00:00.000Z', [first]);

    expect(refreshed.events).toHaveLength(2);
    expect(refreshed.registeredAt).toBe('2026-10-07T00:00:00.000Z');
    expect(partial.events).toHaveLength(2);
    expect(partial.events.map((item) => item.rawStatus)).toEqual(['POSTED', 'IN_TRANSIT']);
  });
});
