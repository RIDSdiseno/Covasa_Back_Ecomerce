export class ErrorApi extends Error {
  status: number;
  details?: unknown;
  code?: string;

  constructor(message: string, status = 500, details?: unknown, code?: string) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}
