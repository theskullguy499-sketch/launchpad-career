// Bound streamed bodies before allocating/decoding the full request.
export class BodyError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
export async function boundedJson(message, maxBytes) {
  const declared = Number(message.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await message.body?.cancel();
    throw new BodyError("Request too large.", 413);
  }
  const reader = message.body?.getReader(),
    chunks = [];
  let size = 0;
  if (reader)
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new BodyError("Request too large.", 413);
      }
      chunks.push(part.value);
    }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new BodyError("Invalid UTF-8 or JSON.", 400);
  }
}
