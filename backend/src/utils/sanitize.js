import sanitizeHtml from 'sanitize-html';

// Strip all HTML — plain text only. Used for free-text fields where we don't want any markup.
export function cleanText(input, maxLength = 5000) {
  if (input == null) return input;
  const str = String(input);
  const clean = sanitizeHtml(str, { allowedTags: [], allowedAttributes: {} }).trim();
  return clean.length > maxLength ? clean.slice(0, maxLength) : clean;
}
