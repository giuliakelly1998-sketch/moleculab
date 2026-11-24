export type ErrorCode =
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'BUSY'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'INVALID_INPUT'
  | 'RDKIT_UNAVAILABLE'
  | 'UNKNOWN';

/** Erro com mensagem já adequada para o usuário final. */
export class AppError extends Error {
  /** Sugestões de termos alternativos (ex.: nomes do autocompletar da PubChem). */
  public suggestions?: string[];
  constructor(public code: ErrorCode, message: string, public detail?: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function toUserMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Ocorreu um erro inesperado.';
}
