const SCRIPT_TAG_PATTERN = /<script[\s\S]*?>[\s\S]*?<\/script\s*>/gi;
const FOREIGN_OBJECT_PATTERN = /<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject\s*>/gi;
const EVENT_HANDLER_ATTRIBUTE_PATTERN = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi;
const DANGEROUS_URI_ATTRIBUTE_PATTERN =
  /\s+(?:xlink:href|href|src)\s*=\s*("(?:javascript|data):[^"]*"|'(?:javascript|data):[^']*')/gi;
const DOCTYPE_OR_ENTITY_PATTERN = /<!(?:DOCTYPE|ENTITY)[\s\S]*?>/gi;
const SVG_ROOT_PATTERN = /<svg[\s>]/i;

/**
 * Best-effort strip of active-content vectors from an uploaded SVG (inline
 * scripts, event handlers, foreignObject, javascript:/data: URIs, external
 * entity declarations) before it's written to disk and served statically.
 * This is not a full XML sanitizer — it narrowly targets the well-known
 * SVG-upload XSS patterns for a logo image, not arbitrary untrusted SVG.
 */
export function sanitizeSvg(content: string): string {
  const sanitized = content
    .replace(SCRIPT_TAG_PATTERN, "")
    .replace(FOREIGN_OBJECT_PATTERN, "")
    .replace(EVENT_HANDLER_ATTRIBUTE_PATTERN, "")
    .replace(DANGEROUS_URI_ATTRIBUTE_PATTERN, "")
    .replace(DOCTYPE_OR_ENTITY_PATTERN, "");

  if (!SVG_ROOT_PATTERN.test(sanitized)) {
    throw new Error("File does not appear to be a valid SVG image.");
  }

  return sanitized;
}
