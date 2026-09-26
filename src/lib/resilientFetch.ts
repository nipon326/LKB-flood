// Wraps fetch with a timeout (so a hung request can't eat the whole
// serverless function budget) and one retry, since flaky upstream
// government/free-API endpoints occasionally drop a connection.
export async function resilientFetch(
  url: string,
  options: RequestInit & { next?: { revalidate?: number } } = {},
  { timeoutMs = 8000, retries = 1 } = {}
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastErr = err;
    }
  }
  const cause =
    lastErr instanceof Error && lastErr.cause instanceof Error
      ? `: ${lastErr.cause.message}`
      : "";
  const message =
    lastErr instanceof Error ? `${lastErr.message}${cause}` : String(lastErr);
  throw new Error(message);
}
