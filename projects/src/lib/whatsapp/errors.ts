export class WhatsAppDispatchError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code: string, retryable = true) {
    super(message);
    this.name = "WhatsAppDispatchError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function toWhatsAppErrorMessage(error: unknown) {
  if (error instanceof WhatsAppDispatchError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "WhatsApp API request timed out.";
    }
    return error.message;
  }

  return "WhatsApp delivery failed.";
}

export function isRetryableWhatsAppError(error: unknown) {
  if (error instanceof WhatsAppDispatchError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") return true;
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("429") ||
      message.includes("503") ||
      message.includes("network")
    );
  }

  return false;
}
