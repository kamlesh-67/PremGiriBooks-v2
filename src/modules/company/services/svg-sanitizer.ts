import { JSDOM } from "jsdom";
import DOMPurify, { type WindowLike } from "dompurify";

import { AppError } from "@/lib/app-error";

const window = new JSDOM("").window;
const purify = DOMPurify(window as unknown as WindowLike);

const SVG_ROOT_PATTERN = /<svg[\s>]/i;

const ALLOWED_SVG_TAGS = [
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "rect",
  "text",
  "tspan",
  "defs",
  "clippath",
  "lineargradient",
  "radialgradient",
  "stop",
  "title",
  "desc",
  "symbol",
  "use",
  "mask",
  "pattern",
];

const ALLOWED_SVG_ATTRIBUTES = [
  "id",
  "class",
  "viewbox",
  "xmlns",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "fill",
  "fill-rule",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-opacity",
  "opacity",
  "transform",
  "points",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientunits",
  "gradienttransform",
  "clip-path",
  "mask",
  "preserveaspectratio",
];

/**
 * Structurally sanitizes an uploaded SVG with DOMPurify (allow-listed SVG
 * elements/attributes only) before it's written to disk and served
 * statically — replaces an earlier regex-based approach, which is fragile
 * against tag-casing/encoding tricks that a real parser handles correctly.
 */
export function sanitizeSvg(content: string): string {
  const sanitized = purify.sanitize(content, {
    USE_PROFILES: { svg: true },
    ALLOWED_TAGS: ALLOWED_SVG_TAGS,
    ALLOWED_ATTR: ALLOWED_SVG_ATTRIBUTES,
    FORBID_TAGS: ["script", "style", "foreignObject", "animate", "animateTransform", "set", "iframe"],
    FORBID_ATTR: ["style", "onload", "onerror", "onclick", "onmouseover"],
    ALLOW_DATA_ATTR: false,
    WHOLE_DOCUMENT: false,
  });

  if (!SVG_ROOT_PATTERN.test(sanitized)) {
    throw new AppError("File does not appear to be a valid SVG image.");
  }

  return sanitized;
}
