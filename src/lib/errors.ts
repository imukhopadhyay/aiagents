/** An expected business-rule failure whose message is safe to show users. */
export class DomainError extends Error {
  constructor(
    message: string,
    /** Optional field the error belongs to, for form display. */
    public readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(what = "Record") {
    super(`${what} not found.`);
    this.name = "NotFoundError";
  }
}
