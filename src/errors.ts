export class NotRegisteredError extends Error {
  constructor(code: string) {
    super(`Código ${code} não está cadastrado.`);
    this.name = 'NotRegisteredError';
  }
}

export class AggregatorError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AggregatorError';
  }
}
