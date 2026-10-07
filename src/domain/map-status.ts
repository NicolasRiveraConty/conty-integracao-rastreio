import type { NormalizedStatus } from './status';

/**
 * Tabela fechada. A busca é exata depois de normalizar caixa e separadores.
 * Não há correspondência por substring: "NOT_DELIVERED" não vira "entregue".
 * Código ausente da tabela vira "desconhecido".
 */
const RAW_TO_NORMALIZED: Readonly<Record<string, NormalizedStatus>> = {
  POSTED: 'postado',
  POSTADO: 'postado',
  OBJ_POSTADO: 'postado',
  OBJETO_POSTADO: 'postado',
  COLLECTED: 'postado',
  COLETADO: 'postado',
  PICKED_UP: 'postado',

  IN_TRANSIT: 'em_transito',
  EM_TRANSITO: 'em_transito',
  TRANSIT: 'em_transito',
  EM_TRANSFERENCIA: 'em_transito',
  FORWARDED: 'em_transito',

  OUT_FOR_DELIVERY: 'saiu_para_entrega',
  SAIU_PARA_ENTREGA: 'saiu_para_entrega',
  SAIU_ENTREGA: 'saiu_para_entrega',
  WITH_COURIER: 'saiu_para_entrega',

  DELIVERED: 'entregue',
  ENTREGUE: 'entregue',
  DELIVERY_CONFIRMED: 'entregue',

  EXCEPTION: 'excecao',
  EXCECAO: 'excecao',
  FAILED_ATTEMPT: 'excecao',
  DELIVERY_FAILED: 'excecao',
  RETURNED: 'excecao',
  HELD: 'excecao',
  ADDRESS_ISSUE: 'excecao',
  CUSTOMS_HOLD: 'excecao',
};

export function normalizeRawKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function mapRawStatus(raw: string): NormalizedStatus {
  return RAW_TO_NORMALIZED[normalizeRawKey(raw)] ?? 'desconhecido';
}
