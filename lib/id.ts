export function generateId(): string {
  const cryptoApi =
    typeof globalThis !== "undefined" && globalThis.crypto
      ? globalThis.crypto
      : undefined;
  const randomUuid = cryptoApi
    ? (cryptoApi as Crypto & { randomUUID?: () => string }).randomUUID
    : undefined;

  if (typeof randomUuid === "function") {
    return randomUuid.call(cryptoApi);
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
