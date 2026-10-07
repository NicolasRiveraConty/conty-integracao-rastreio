import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES_WITHOUT_AGGREGATOR_DIALECT = [
  'src/tracking-service.ts',
  'src/app.ts',
  'src/domain/delay.ts',
  'src/domain/map-status.ts',
  'src/persistence/shipment-repository.ts',
  'src/providers/tracking-provider.ts',
];

describe('fronteira do agregador', () => {
  it('não espalha o formato bruto fora do cliente HTTP', () => {
    for (const file of FILES_WITHOUT_AGGREGATOR_DIALECT) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(source, file).not.toContain('status_code');
      expect(source, file).not.toContain('checkpoints');
      expect(source, file).not.toContain('tracking_code');
    }
  });
});
