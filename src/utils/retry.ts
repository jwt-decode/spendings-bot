export async function withRetry<T>(
  action: () => Promise<T>,
  attempts = 5,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      const delay = baseDelayMs * Math.pow(2, i);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
