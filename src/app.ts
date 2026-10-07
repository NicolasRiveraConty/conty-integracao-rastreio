import Fastify, { type FastifyError } from 'fastify';
import type { Clock } from './clock';
import { systemClock } from './clock';
import { AggregatorError, NotRegisteredError } from './errors';
import { MemoryShipmentRepository, type ShipmentRepository } from './persistence/shipment-repository';
import type { TrackingProvider } from './providers/tracking-provider';
import { TrackingService } from './tracking-service';

const CODE_PATTERN = /^[A-Za-z0-9._-]+$/;

export interface BuildAppOptions {
  provider: TrackingProvider;
  repository?: ShipmentRepository;
  clock?: Clock;
  delayThresholdHours?: number;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions) {
  const repository = options.repository ?? new MemoryShipmentRepository();
  const clock = options.clock ?? systemClock;
  const delayThresholdHours = options.delayThresholdHours ?? 72;
  const service = new TrackingService(options.provider, repository, clock, delayThresholdHours);

  const app = Fastify({ logger: options.logger ?? false });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof NotRegisteredError) {
      return reply.code(404).send({ erro: 'nao_cadastrado', mensagem: error.message });
    }
    if (error instanceof AggregatorError) {
      return reply.code(502).send({ erro: 'agregador_indisponivel', mensagem: error.message });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({
        erro: 'requisicao_invalida',
        mensagem: 'Informe codigo com letras, números, ponto, hífen ou sublinhado.',
      });
    }

    app.log.error(error);
    return reply.code(500).send({ erro: 'erro_interno', mensagem: 'Erro interno.' });
  });

  app.get('/health', async () => ({ ok: true }));

  app.post<{ Body: { codigo: string } }>(
    '/rastreios',
    {
      schema: {
        body: {
          type: 'object',
          required: ['codigo'],
          additionalProperties: false,
          properties: {
            codigo: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9._-]+$' },
          },
        },
      },
    },
    async (request, reply) => {
      const { rastreio, created } = await service.register(request.body.codigo);
      return reply.code(created ? 201 : 200).send(rastreio);
    },
  );

  app.get<{ Params: { codigo: string } }>('/rastreios/:codigo', async (request) => {
    const codigo = request.params.codigo;
    if (!CODE_PATTERN.test(codigo)) {
      throw Object.assign(new Error('Código inválido.'), { statusCode: 400 });
    }
    return service.consult(codigo);
  });

  return app;
}
