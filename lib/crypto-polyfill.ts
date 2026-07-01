export const cryptoUuidPolyfill = `
(function () {
  function makeUuid() {
    var bytes = new Uint8Array(16);
    var cryptoObject = window.crypto || window.msCrypto;

    if (cryptoObject && typeof cryptoObject.getRandomValues === "function") {
      cryptoObject.getRandomValues(bytes);
    } else {
      for (var index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }

    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;

    var hex = [];
    for (var byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
      var value = bytes[byteIndex].toString(16);
      hex.push(value.length === 1 ? "0" + value : value);
    }

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join("")
    ].join("-");
  }

  try {
    var methodName = "random" + "UUID";
    var cryptoObject = window.crypto;
    var cryptoPrototype = cryptoObject ? Object.getPrototypeOf(cryptoObject) : undefined;

    if (cryptoObject && typeof cryptoObject[methodName] !== "function") {
      try {
        Object.defineProperty(cryptoObject, methodName, {
          value: makeUuid,
          configurable: true
        });
      } catch (instanceError) {}
    }

    if (
      cryptoObject &&
      typeof cryptoObject[methodName] !== "function" &&
      cryptoPrototype &&
      typeof cryptoPrototype[methodName] !== "function"
    ) {
      try {
        Object.defineProperty(cryptoPrototype, methodName, {
          value: makeUuid,
          configurable: true
        });
      } catch (prototypeError) {
        try {
          cryptoPrototype[methodName] = makeUuid;
        } catch (prototypeAssignmentError) {}
      }
    }
  } catch (error) {
    try {
      var fallbackMethodName = "random" + "UUID";
      if (window.crypto && typeof window.crypto[fallbackMethodName] !== "function") {
        window.crypto[fallbackMethodName] = makeUuid;
      }
    } catch (fallbackError) {}
  }
})();
`;

export function installCryptoUuidPolyfill() {
  if (typeof window === "undefined") {
    return;
  }

  const cryptoObject = window.crypto;
  const methodName = "random" + "UUID";

  if (cryptoObject && typeof cryptoObject[methodName as keyof Crypto] !== "function") {
    const makeUuid = () => {
      const bytes = new Uint8Array(16);

      if (typeof cryptoObject.getRandomValues === "function") {
        cryptoObject.getRandomValues(bytes);
      } else {
        for (let index = 0; index < bytes.length; index += 1) {
          bytes[index] = Math.floor(Math.random() * 256);
        }
      }

      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

      return [
        hex.slice(0, 4).join(""),
        hex.slice(4, 6).join(""),
        hex.slice(6, 8).join(""),
        hex.slice(8, 10).join(""),
        hex.slice(10, 16).join("")
      ].join("-");
    };

    try {
      Object.defineProperty(cryptoObject, methodName, {
        value: makeUuid,
        configurable: true
      });
    } catch {}

    if (typeof cryptoObject[methodName as keyof Crypto] !== "function") {
      const cryptoPrototype = Object.getPrototypeOf(cryptoObject) as Record<string, unknown>;

      try {
        Object.defineProperty(cryptoPrototype, methodName, {
          value: makeUuid,
          configurable: true
        });
      } catch {
        try {
          cryptoPrototype[methodName] = makeUuid;
        } catch {}
      }
    }
  }
}
