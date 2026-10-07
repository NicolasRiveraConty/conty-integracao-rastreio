import { buildApp } from './app';
import { loadConfig } from './config';
import { HttpAggregatorProvider } from './providers/http-aggregator';

const config = loadConfig();

const app = buildApp({
  provider: new HttpAggregatorProvider({ baseUrl: config.aggregatorBaseUrl }),
  delayThresholdHours: config.delayThresholdHours,
  logger: true,
});

await app.listen({ port: config.port, host: config.host });
