import { dedupeEvents, type TrackingEvent } from '../domain/tracking-event';

export interface Shipment {
  code: string;
  registeredAt: string;
  events: TrackingEvent[];
}

export interface ShipmentRepository {
  findByCode(code: string): Shipment | undefined;
  /**
   * Cria ou atualiza o código. Eventos com a mesma chave
   * (código, timestamp, status bruto) são ignorados. Histórico antigo permanece.
   */
  upsert(code: string, registeredAt: string, events: readonly TrackingEvent[]): Shipment;
}

export class MemoryShipmentRepository implements ShipmentRepository {
  private readonly shipments = new Map<string, Shipment>();

  findByCode(code: string): Shipment | undefined {
    const found = this.shipments.get(code);
    return found ? cloneShipment(found) : undefined;
  }

  upsert(code: string, registeredAt: string, events: readonly TrackingEvent[]): Shipment {
    const previous = this.shipments.get(code);
    const shipment: Shipment = {
      code,
      registeredAt: previous?.registeredAt ?? registeredAt,
      events: dedupeEvents([...(previous?.events ?? []), ...events]),
    };
    this.shipments.set(code, shipment);
    return cloneShipment(shipment);
  }
}

function cloneShipment(shipment: Shipment): Shipment {
  return {
    code: shipment.code,
    registeredAt: shipment.registeredAt,
    events: shipment.events.map((event) => ({ ...event })),
  };
}
