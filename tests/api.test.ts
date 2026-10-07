import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { Clock } from '../src/clock';
import { HttpAggregatorProvider } from '../src/providers/http-aggregator';
import type { Rastreio } from '../src/tracking-service';
import { aggregatorPayload, sendJson, startFakeAggregator, type FakeAggregator } from './helpers';

const NOW = new Date('2026-10-07T15:00:00.000Z');
const clock: Clock = { now: () => NOW };
const LIMIT = 72;

let fake: FakeAggregator | undefined;

afterEach(async () => {
  await fake?.close();
  fake = undefined;
});

async function appWith(payloads: Record<string, ReturnType<typeof aggregatorPayload>>) {
  fake = await startFakeAggregator((request, response) => {
    const code = decodeURIComponent((request.url ?? '').replace('/v1/track/', ''));
    const payload = payloads[code];
    if (!payload) {
      sendJson(response, 404, { error: 'unknown_tracking_code' });
      return;
    }
    sendJson(response, 200, payload);
  });

  const app = buildApp({
    provider: new HttpAggregatorProvider({ baseUrl: fake.url }),
    clock,
    delayThresholdHours: LIMIT,
  });

  return app;
}

describe('API de rastreio', () => {
  it('normaliza o payload, deduplica a nova consulta e não trata entrega como atraso', async () => {
    const posted = { timestamp: '2026-10-01T15:00:00.000Z', status_code: 'OBJ_POSTADO', message: 'Objeto postado' };
    const transit = { timestamp: '2026-10-02T15:00:00.000Z', status_code: 'IN_TRANSIT', message: 'Em trânsito' };
    const delivered = { timestamp: '2026-10-06T15:00:00.000Z', status_code: 'DELIVERED', message: 'Entregue' };
    const unknown = { timestamp: '2026-10-03T15:00:00.000Z', status_code: 'BANANA_STATUS', message: 'Código inventado' };

    const payloads = {
      BRATRASO: aggregatorPayload('BRATRASO', [posted, transit]),
      BRENTREGUE: aggregatorPayload('BRENTREGUE', [posted, delivered]),
      BRDESCONHECIDO: aggregatorPayload('BRDESCONHECIDO', [posted, unknown]),
    };
    const app = await appWith(payloads);

    const late = await app.inject({ method: 'POST', url: '/rastreios', payload: { codigo: 'BRATRASO' } });
    const lateBody = late.json() as Rastreio;
    expect(late.statusCode).toBe(201);
    expect(lateBody.status).toBe('em_transito');
    expect(lateBody.atrasado).toBe(true);
    expect(lateBody.motivo).toBe('acima_do_limite');
    expect(lateBody.historico.map((item) => item.status)).toEqual(['postado', 'em_transito']);

    const again = await app.inject({ method: 'GET', url: '/rastreios/BRATRASO' });
    const againBody = again.json() as Rastreio;
    expect(again.statusCode).toBe(200);
    expect(againBody.historico).toHaveLength(2);

    payloads.BRATRASO = aggregatorPayload('BRATRASO', [posted, transit, unknown]);
    const updated = await app.inject({ method: 'GET', url: '/rastreios/BRATRASO' });
    const updatedBody = updated.json() as Rastreio;
    expect(updatedBody.historico).toHaveLength(3);
    expect(updatedBody.status).toBe('desconhecido');
    expect(updatedBody.historico.at(-1)?.status).not.toBe('entregue');

    const deliveredResponse = await app.inject({
      method: 'POST',
      url: '/rastreios',
      payload: { codigo: 'BRENTREGUE' },
    });
    const deliveredBody = deliveredResponse.json() as Rastreio;
    expect(deliveredBody.status).toBe('entregue');
    expect(deliveredBody.atrasado).toBe(false);
    expect(deliveredBody.motivo).toBe('entregue');
    expect(deliveredBody.horasDesdePostagem).toBeGreaterThan(LIMIT);

    const unknownResponse = await app.inject({
      method: 'POST',
      url: '/rastreios',
      payload: { codigo: 'BRDESCONHECIDO' },
    });
    const unknownBody = unknownResponse.json() as Rastreio;
    expect(unknownBody.status).toBe('desconhecido');
    expect(unknownBody.status).not.toBe('entregue');
    expect(unknownBody.atrasado).toBe(true);

    const duplicate = await app.inject({ method: 'POST', url: '/rastreios', payload: { codigo: 'BRATRASO' } });
    expect(duplicate.statusCode).toBe(200);
    expect((duplicate.json() as Rastreio).historico).toHaveLength(3);

    await app.close();
  });

  it('mantém o histórico quando a segunda consulta ao agregador falha', async () => {
    let calls = 0;
    fake = await startFakeAggregator((_request, response) => {
      calls += 1;
      if (calls === 1) {
        sendJson(
          response,
          200,
          aggregatorPayload('BR1', [
            { timestamp: '2026-10-06T15:00:00.000Z', status_code: 'POSTED', message: 'Postado' },
          ]),
        );
        return;
      }
      sendJson(response, 500, { error: 'upstream' });
    });

    const app = buildApp({
      provider: new HttpAggregatorProvider({ baseUrl: fake.url }),
      clock,
      delayThresholdHours: LIMIT,
    });

    const created = await app.inject({ method: 'POST', url: '/rastreios', payload: { codigo: 'BR1' } });
    expect(created.statusCode).toBe(201);
    expect((created.json() as Rastreio).atrasado).toBe(false);
    expect((created.json() as Rastreio).motivo).toBe('dentro_do_limite');

    const failed = await app.inject({ method: 'GET', url: '/rastreios/BR1' });
    expect(failed.statusCode).toBe(502);

    calls = 0;
    const recovered = await app.inject({ method: 'GET', url: '/rastreios/BR1' });
    const recoveredBody = recovered.json() as Rastreio;
    expect(recovered.statusCode).toBe(200);
    expect(recoveredBody.historico).toHaveLength(1);

    await app.close();
  });

  it('responde 400, 404 e 502 nos casos de borda', async () => {
    fake = await startFakeAggregator((_request, response) => {
      sendJson(response, 404, { error: 'unknown_tracking_code' });
    });
    const app = buildApp({
      provider: new HttpAggregatorProvider({ baseUrl: fake.url }),
      clock,
      delayThresholdHours: LIMIT,
    });

    const invalid = await app.inject({ method: 'POST', url: '/rastreios', payload: { codigo: '' } });
    expect(invalid.statusCode).toBe(400);

    const missing = await app.inject({ method: 'GET', url: '/rastreios/AINDA_NAO' });
    expect(missing.statusCode).toBe(404);

    const upstream = await app.inject({ method: 'POST', url: '/rastreios', payload: { codigo: 'SUMIU' } });
    expect(upstream.statusCode).toBe(502);

    const stillMissing = await app.inject({ method: 'GET', url: '/rastreios/SUMIU' });
    expect(stillMissing.statusCode).toBe(404);

    await app.close();
  });
});
