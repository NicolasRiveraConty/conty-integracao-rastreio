import { describe, expect, it } from 'vitest';
import { mapRawStatus } from '../src/domain/map-status';

describe('mapRawStatus', () => {
  it('traduz os dialetos conhecidos para o conjunto estável', () => {
    expect(mapRawStatus('OBJ_POSTADO')).toBe('postado');
    expect(mapRawStatus('posted')).toBe('postado');
    expect(mapRawStatus('in transit')).toBe('em_transito');
    expect(mapRawStatus('out-for-delivery')).toBe('saiu_para_entrega');
    expect(mapRawStatus(' DELIVERED ')).toBe('entregue');
    expect(mapRawStatus('DELIVERY_FAILED')).toBe('excecao');
  });

  it('não transforma status desconhecido em entregue', () => {
    const desconhecidos = [
      '',
      '   ',
      '???',
      'BANANA_STATUS',
      'NOT_DELIVERED',
      'DELIVERED_MAYBE',
      'ENTREGUE_AO_VIZINHO',
      'DELIVERY',
      'FOO',
    ];

    for (const raw of desconhecidos) {
      expect(mapRawStatus(raw), raw).toBe('desconhecido');
      expect(mapRawStatus(raw), raw).not.toBe('entregue');
    }
  });
});
