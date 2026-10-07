import type { Clock } from './clock';
import { assessDelay } from './domain/delay';
import type { NormalizedStatus } from './domain/status';
import type { TrackingEvent } from './domain/tracking-event';
import { NotRegisteredError } from './errors';
import type { ShipmentRepository } from './persistence/shipment-repository';
import type { TrackingProvider } from './providers/tracking-provider';

export interface HistoricoItem {
  ocorridoEm: string;
  statusBruto: string;
  status: NormalizedStatus;
  descricao: string | null;
}

export interface Rastreio {
  codigo: string;
  status: NormalizedStatus | null;
  atrasado: boolean;
  motivo: 'sem_eventos' | 'sem_postagem' | 'entregue' | 'dentro_do_limite' | 'acima_do_limite';
  limiteHoras: number;
  postadoEm: string | null;
  horasDesdePostagem: number | null;
  historico: HistoricoItem[];
}

export class TrackingService {
  constructor(
    private readonly provider: TrackingProvider,
    private readonly repository: ShipmentRepository,
    private readonly clock: Clock,
    private readonly delayThresholdHours: number,
  ) {}

  async register(code: string): Promise<{ rastreio: Rastreio; created: boolean }> {
    const existing = this.repository.findByCode(code);
    const events = await this.provider.fetchTracking(code);
    const shipment = this.repository.upsert(code, this.clock.now().toISOString(), events);
    return {
      rastreio: this.toRastreio(shipment.code, shipment.events),
      created: !existing,
    };
  }

  async consult(code: string): Promise<Rastreio> {
    const existing = this.repository.findByCode(code);
    if (!existing) throw new NotRegisteredError(code);

    const events = await this.provider.fetchTracking(code);
    const shipment = this.repository.upsert(code, existing.registeredAt, events);
    return this.toRastreio(shipment.code, shipment.events);
  }

  private toRastreio(code: string, events: readonly TrackingEvent[]): Rastreio {
    const assessment = assessDelay(events, this.clock.now(), this.delayThresholdHours);
    const latest = events.at(-1);

    return {
      codigo: code,
      status: latest?.status ?? null,
      atrasado: assessment.delayed,
      motivo: assessment.reason,
      limiteHoras: this.delayThresholdHours,
      postadoEm: assessment.postedAt,
      horasDesdePostagem: roundHours(assessment.elapsedHours),
      historico: events.map((event) => ({
        ocorridoEm: event.occurredAt,
        statusBruto: event.rawStatus,
        status: event.status,
        descricao: event.description,
      })),
    };
  }
}

function roundHours(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value * 100) / 100;
}
