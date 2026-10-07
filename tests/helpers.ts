import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export interface FakeAggregator {
  url: string;
  requests: string[];
  setHandler(handler: (request: IncomingMessage, response: ServerResponse) => void): void;
  close(): Promise<void>;
}

export function startFakeAggregator(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<FakeAggregator> {
  let current = handler;
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(`${request.method ?? 'GET'} ${request.url ?? '/'}`);
    current(request, response);
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Não foi possível abrir o agregador fake.'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        requests,
        setHandler(next) {
          current = next;
        },
        close() {
          return new Promise((done, fail) => {
            server.close((error) => (error ? fail(error) : done()));
          });
        },
      });
    });
  });
}

export function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function aggregatorPayload(
  code: string,
  checkpoints: Array<{ timestamp: string; status_code: string; message?: string; city?: string }>,
) {
  return {
    tracking_code: code,
    carrier: 'correios',
    checkpoints,
  };
}
