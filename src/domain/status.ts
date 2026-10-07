export const NORMALIZED_STATUSES = [
  'postado',
  'em_transito',
  'saiu_para_entrega',
  'entregue',
  'excecao',
  'desconhecido',
] as const;

export type NormalizedStatus = (typeof NORMALIZED_STATUSES)[number];
