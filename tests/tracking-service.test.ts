import { describe, expect, it } from 'vitest';
import type { Clock } from '../src/clock';
import type { TrackingEvent } from '../src/domain/tracking-event';
import { MemoryShipmentRepository } from '../src/persistence/shipment-repository';
import type { TrackingProvider } from '../src/providers/tracking-provider';
import { TrackingService } from '../src/tracking-service';

class StaticProvider implements TrackingProvider {
  constructor(private readonly events: TrackingEvent[]) {}

  fetchTracking(code: string): Promise<TrackingEvent[]> {
    return Promise.resolve(this.events.filter((event) => event.code === code));
  }
}

const clock: Clock = {
  now: () => new Date('2026-10-07T15:00:00.000Z'),
};

describe('troca de agregador', () => {
  it('funciona com outro provider que não fala o JSON do agregador HTTP', async () => {
    const provider = new StaticProvider([
      {
        code: 'OUTRO1',
        occurredAt: '2026-10-01T15:00:00.000Z',
        rawStatus: 'SCAN-01',
        status: 'postado',
        description: 'evento interno do fornecedor B',
      },
      {
        code: 'OUTRO1',
        occurredAt: '2026-10-02T15:00:00.000Z',
        rawStatus: 'SCAN-09',
        status: 'em_transito',
        description: null,
      },
    ]);

    const service = new TrackingService(provider, new MemoryShipmentRepository(), clock, 72);
    const { rastreio, created } = await service.register('OUTRO1');

    expect(created).toBe(true);
    expect(rastreio.status).toBe('em_transito');
    expect(rastreio.atrasado).toBe(true);
    expect(rastreio.historico.map((item) => item.statusBruto)).toEqual(['SCAN-01', 'SCAN-09']);
    expect(JSON.stringify(rastreio)).not.toContain('checkpoints');
    expect(JSON.stringify(rastreio)).not.toContain('status_code');
  });
});
