// Provider HTML is converted to inert plain text, never trusted as browser markup.
export function providerDescription(value) {
  if (typeof value !== "string")
    return { descriptionText: "", descriptionTruncated: false };
  const input = value.slice(0, 120000);
  const entities = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    bull: "•",
    rsquo: "’",
    lsquo: "‘",
    ldquo: "“",
    rdquo: "”",
  };
  const pieces = [];
  const blockedTags = new Set([
    "script",
    "style",
    "iframe",
    "svg",
    "form",
    "noscript",
  ]);
  const blockTags = new Set([
    "p",
    "div",
    "ul",
    "ol",
    "section",
    "article",
    "table",
    "tr",
    "blockquote",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
  ]);
  let cursor = 0,
    blocked = "";
  // Forward-only token scan: repeated unclosed tags cannot trigger regex backtracking.
  while (cursor < input.length) {
    const open = input.indexOf("<", cursor);
    if (open < 0) {
      if (!blocked) pieces.push(input.slice(cursor));
      break;
    }
    if (!blocked) pieces.push(input.slice(cursor, open));
    if (input.startsWith("<!--", open)) {
      const close = input.indexOf("-->", open + 4);
      cursor = close < 0 ? input.length : close + 3;
      continue;
    }
    const close = input.indexOf(">", open + 1);
    if (close < 0) {
      if (!blocked) pieces.push(input.slice(open));
      break;
    }
    const tag = input
      .slice(open + 1, close)
      .match(/^\s*(\/?)\s*([a-z0-9]+)\b/i);
    if (tag) {
      const closing = Boolean(tag[1]),
        name = tag[2].toLowerCase();
      if (blocked) {
        if (closing && name === blocked) blocked = "";
      } else if (!closing && blockedTags.has(name)) blocked = name;
      else if (!closing && name === "li") pieces.push("\n• ");
      else if (blockTags.has(name)) pieces.push("\n");
    }
    cursor = close + 1;
  }
  const text = pieces
    .join("")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
      if (code[0] !== "#") return entities[code.toLowerCase()] ?? match;
      const number =
        code[1].toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return number > 0 &&
        number <= 0x10ffff &&
        !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number)
        : "";
    })
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\t \r]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    descriptionText: text.slice(0, 24000),
    descriptionTruncated: value.length > input.length || text.length > 24000,
  };
}
