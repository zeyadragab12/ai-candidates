// pdf-parse (via pdfjs-dist) expects a browser-provided `DOMMatrix` global.
// Node.js has no such global, so this must run before pdf-parse is imported.
import DOMMatrixPolyfill from "dommatrix";

declare global {
  // eslint-disable-next-line no-var
  var DOMMatrix: typeof DOMMatrixPolyfill | undefined;
}

if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}
