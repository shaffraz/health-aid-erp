const DEFAULT_SUPABASE_TIMEOUT_MS = 2000;

export function supabaseRequestTimeoutMs() {
  const configuredTimeout = Number(process.env.SUPABASE_REQUEST_TIMEOUT_MS);

  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_SUPABASE_TIMEOUT_MS;
}

export function isSupabaseConfigured() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return false;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    return ["http:", "https:"].includes(parsedUrl.protocol) && anonKey.trim().length > 20;
  } catch {
    return false;
  }
}

export function withSupabaseTimeout<T>(
  operation: PromiseLike<T>,
  label: string,
  timeoutMs = supabaseRequestTimeoutMs()
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(operation).then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
