function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}

export async function hmacSha256(key: string, message: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(key);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const data = new TextEncoder().encode(message);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return bytesToHex(new Uint8Array(sig));
}

export async function generateDrawNumbers(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  poolSize = 80,
  drawCount = 20
): Promise<number[]> {
  const pool = new Set<number>();
  let counter = 0;

  while (pool.size < drawCount) {
    const hmac = await hmacSha256(serverSeed, `${clientSeed}:${nonce}:${counter}`);

    for (let i = 0; i < hmac.length - 1 && pool.size < drawCount; i += 2) {
      const value = parseInt(hmac.substring(i, i + 2), 16);
      const number = (value % poolSize) + 1;
      pool.add(number);
    }

    counter++;
  }

  return Array.from(pool).sort((a, b) => a - b);
}
