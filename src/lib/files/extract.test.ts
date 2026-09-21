import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import {
  extractTextFromFile,
  getFileTypeFromName,
  UnsupportedFileTypeError,
  FileExtractionError,
} from "./extract";

const MINIMAL_PDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 300 300] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 58 >>
stream
BT /F1 24 Tf 10 200 Td (Hello PDF World) Tj ET
endstream
endobj
trailer
<< /Size 6 /Root 1 0 R >>
%%EOF
`;

async function buildMinimalDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
  </w:body>
</w:document>`,
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

describe("getFileTypeFromName", () => {
  it("detects pdf, docx, and txt by extension", () => {
    expect(getFileTypeFromName("resume.pdf")).toBe("pdf");
    expect(getFileTypeFromName("resume.DOCX")).toBe("docx");
    expect(getFileTypeFromName("resume.txt")).toBe("txt");
  });

  it("returns null for unrecognized extensions", () => {
    expect(getFileTypeFromName("resume.pages")).toBeNull();
  });
});

describe("extractTextFromFile", () => {
  it("extracts text from a PDF", async () => {
    const buffer = Buffer.from(MINIMAL_PDF, "utf-8");
    const text = await extractTextFromFile(buffer, "resume.pdf");
    expect(text).toContain("Hello PDF World");
  });

  it("extracts text from a DOCX", async () => {
    const buffer = await buildMinimalDocx("Hello DOCX World");
    const text = await extractTextFromFile(buffer, "resume.docx");
    expect(text).toContain("Hello DOCX World");
  });

  it("extracts text from a TXT file", async () => {
    const buffer = Buffer.from("Hello TXT World", "utf-8");
    const text = await extractTextFromFile(buffer, "resume.txt");
    expect(text).toBe("Hello TXT World");
  });

  it("throws UnsupportedFileTypeError for an unrecognized extension", async () => {
    const buffer = Buffer.from("whatever", "utf-8");
    await expect(extractTextFromFile(buffer, "resume.pages")).rejects.toThrow(
      UnsupportedFileTypeError,
    );
  });

  it("throws FileExtractionError for a corrupt PDF instead of crashing", async () => {
    const buffer = Buffer.from("this is not a real pdf", "utf-8");
    await expect(extractTextFromFile(buffer, "resume.pdf")).rejects.toThrow(
      FileExtractionError,
    );
  });

  it("throws FileExtractionError for a corrupt DOCX instead of crashing", async () => {
    const buffer = Buffer.from("this is not a real docx", "utf-8");
    await expect(extractTextFromFile(buffer, "resume.docx")).rejects.toThrow(
      FileExtractionError,
    );
  });
});
