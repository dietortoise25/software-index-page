import DOMPurify from "dompurify"

const ALLOWED_TAGS = [
  "p", "br", "b", "i", "em", "strong", "a", "img",
  "ul", "ol", "li", "code", "pre", "blockquote",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "table", "thead", "tbody", "tr", "th", "td",
  "span", "div", "del", "ins", "dl", "dt", "dd", "sup", "sub",
]

const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "class", "id", "width", "height"]

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}
