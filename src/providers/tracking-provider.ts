import type { TrackingEvent } from '../domain/tracking-event';

/**
 * Contrato do agregador de rastreio.
 * Quem implementa traduz o dialeto do fornecedor para TrackingEvent.
 * Serviço, repositório e rotas só enxergam esse formato.
 */
export interface TrackingProvider {
  fetchTracking(code: string): Promise<TrackingEvent[]>;
}
