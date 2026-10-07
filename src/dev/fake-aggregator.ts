import { createServer } from 'node:http';

/**
 * Agregador fictício para rodar a API localmente.
 * O formato abaixo é o dialeto externo; a API não o reexporta.
 */
const port = Number(process.env.AGGREGATOR_PORT ?? 4000);

const fixed: Record<string, unknown> = {
  BRATRASO000BR: {
    tracking_code: 'BRATRASO000BR',
    carrier: 'correios',
    checkpoints: [
      {
        timestamp: '2026-01-01T12:00:00.000Z',
        status_code: 'OBJ_POSTADO',
        message: 'Objeto postado',
        city: 'Curitiba',
      },
      {
        timestamp: '2026-01-02T09:30:00.000Z',
        status_code: 'IN_TRANSIT',
        message: 'Em transferência para a unidade de destino',
        city: 'São Paulo',
      },
    ],
  },
  BRENTREGUE00BR: {
    tracking_code: 'BRENTREGUE00BR',
    carrier: 'jadlog',
    checkpoints: [
      {
        timestamp: '2026-01-01T12:00:00.000Z',
        status_code: 'POSTED',
        message: 'Coletado',
        city: 'Recife',
      },
      {
        timestamp: '2026-01-10T18:00:00.000Z',
        status_code: 'DELIVERED',
        message: 'Entrega realizada',
        city: 'Olinda',
      },
    ],
  },
  BRDESCONHECIDO: {
    tracking_code: 'BRDESCONHECIDO',
    carrier: 'loggi',
    checkpoints: [
      {
        timestamp: '2026-01-01T12:00:00.000Z',
        status_code: 'OBJ_POSTADO',
        message: 'Objeto postado',
        city: 'Belém',
      },
      {
        timestamp: '2026-01-03T16:00:00.000Z',
        status_code: 'BANANA_STATUS',
        message: 'Código que a transportadora inventou',
        city: 'Ananindeua',
      },
    ],
  },
};

function payloadFor(code: string): unknown | undefined {
  if (code === 'BRCAMINHO00BR') {
    return {
      tracking_code: code,
      carrier: 'loggi',
      checkpoints: [
        {
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status_code: 'posted',
          message: 'Postado há cerca de duas horas',
          city: 'Belo Horizonte',
        },
      ],
    };
  }
  return fixed[code];
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const match = url.pathname.match(/^\/v1\/track\/([^/]+)$/);

  if (request.method !== 'GET' || !match) {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not_found' }));
    return;
  }

  const code = decodeURIComponent(match[1] ?? '');
  const payload = payloadFor(code);
  if (!payload) {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'unknown_tracking_code', tracking_code: code }));
    return;
  }

  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Agregador fictício em http://127.0.0.1:${port}`);
  console.log('Códigos: BRATRASO000BR, BRENTREGUE00BR, BRCAMINHO00BR, BRDESCONHECIDO');
});
