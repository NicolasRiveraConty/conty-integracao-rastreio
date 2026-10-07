import { afterEach, describe, expect, it } from 'vitest';
import { AggregatorError } from '../src/errors';
import { HttpAggregatorProvider, parseAggregatorPayload } from '../src/providers/http-aggregator';
import { aggregatorPayload, sendJson, startFakeAggregator, type FakeAggregator } from './helpers';

let fake: FakeAggregator | undefined;

afterEach(async () => {
  await fake?.close();
  fake = undefined;
});

describe('HttpAggregatorProvider', () => {
  it('busca o código e devolve eventos já normalizados', async () => {
    fake = await startFakeAggregator((request, response) => {
      expect(request.url).toBe('/v1/track/BR123');
      sendJson(
        response,
        200,
        aggregatorPayload('BR123', [
          { timestamp: '2026-10-01T12:00:00.000Z', status_code: 'OBJ_POSTADO', message: 'Objeto postado' },
          { timestamp: '2026-10-03T16:00:00Z', status_code: 'BANANA_STATUS', message: 'Código inventado' },
        ]),
      );
    });

    const provider = new HttpAggregatorProvider({ baseUrl: fake.url });
    const events = await provider.fetchTracking('BR123');

    expect(events).toEqual([
      {
        code: 'BR123',
        occurredAt: '2026-10-01T12:00:00.000Z',
        rawStatus: 'OBJ_POSTADO',
        status: 'postado',
        description: 'Objeto postado',
      },
      {
        code: 'BR123',
        occurredAt: '2026-10-03T16:00:00.000Z',
        rawStatus: 'BANANA_STATUS',
        status: 'desconhecido',
        description: 'Código inventado',
      },
    ]);
    expect(events.some((event) => event.status === 'entregue')).toBe(false);
  });

  it('falha com erro próprio quando o agregador não responde 200', async () => {
    fake = await startFakeAggregator((_request, response) => {
      sendJson(response, 404, { error: 'unknown_tracking_code' });
    });

    const provider = new HttpAggregatorProvider({ baseUrl: fake.url });
    await expect(provider.fetchTracking('NAOEXISTE')).rejects.toBeInstanceOf(AggregatorError);
  });

  it('rejeita payload fora do dialeto esperado', () => {
    expect(() => parseAggregatorPayload({ foo: [] }, 'BR1')).toThrow(AggregatorError);
    expect(() =>
      parseAggregatorPayload(
        aggregatorPayload('BR1', [{ timestamp: 'ontem', status_code: 'POSTED' }]),
        'BR1',
      ),
    ).toThrow(AggregatorError);
  });
});
