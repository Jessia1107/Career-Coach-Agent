function extractFencedJson(raw) {
  const text = String(raw || '');
  const match = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : '';
}

function findBalancedValue(text, startIndex) {
  const opener = text[startIndex];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === opener) {
      depth += 1;
    } else if (char === closer) {
      depth -= 1;
      if (depth === 0) return text.slice(startIndex, index + 1);
    }
  }

  return '';
}

function extractFirstJsonValue(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const fenced = extractFencedJson(text);
  const source = fenced || text;
  const firstObject = source.search(/[\[{]/);
  if (firstObject === -1) return null;

  const value = findBalancedValue(source, firstObject);
  return value || null;
}

function parseFirstJsonValue(raw) {
  const extracted = extractFirstJsonValue(raw);
  if (!extracted) return null;
  return JSON.parse(extracted);
}

module.exports = {
  extractFirstJsonValue,
  parseFirstJsonValue,
};
