/**
 * Protocol-level error categories.
 *
 * Uses kebab-case to be consistent with the rest of the NCP type literals
 * (e.g. endpoint kinds, latency profiles).
 */
export type NcpErrorCode =
  | "config-error"
  | "auth-error"
  | "runtime-error"
  | "timeout-error"
  | "abort-error";

/**
 * Structured error payload used on endpoint and stream boundaries.
 *
 * Prefer this over raw `Error` objects when crossing async/transport
 * boundaries so that error metadata survives serialization.
 */
export type NcpError = {
  /** Machine-readable category. */
  code: NcpErrorCode;
  /** Human-readable description intended for developers, not end-users. */
  message: string;
  /** Optional structured context (request ids, field paths, etc.). */
  details?: Record<string, unknown>;
  /** Original cause — preserved for debugging but not guaranteed serializable. */
  cause?: unknown;
};

/**
 * Throwable form of `NcpError` for use in exception-based control flows.
 *
 * Bridges typed protocol errors with standard JS `Error` hierarchies so that
 * `instanceof` checks and stack traces work as expected.
 *
 * @example
 * throw new NcpErrorException("auth-error", "Missing API key");
 */
export class NcpErrorException extends Error {
  readonly code: NcpErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: NcpErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "NcpErrorException";
    this.code = code;
    this.details = details;
  }
}
