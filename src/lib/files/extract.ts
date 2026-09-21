import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export type SupportedFileType = "pdf" | "docx" | "txt";

export class UnsupportedFileTypeError extends Error {
  constructor(extension: string) {
    super(
      `Unsupported file type "${extension}". Supported types: PDF, DOCX, TXT.`,
    );
    this.name = "UnsupportedFileTypeError";
  }
}

export class FileExtractionError extends Error {
  constructor(fileType: SupportedFileType, cause?: unknown) {
    super(
      `Could not extract text from this ${fileType.toUpperCase()} file. It may be corrupted or password-protected.`,
    );
    this.name = "FileExtractionError";
    this.cause = cause;
  }
}

export function getFileTypeFromName(
  filename: string,
): SupportedFileType | null {
  const extension = filename.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "txt":
      return "txt";
    default:
      return null;
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

function extractTxtText(buffer: Buffer): string {
  return buffer.toString("utf-8").trim();
}

export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const fileType = getFileTypeFromName(filename);

  if (!fileType) {
    const extension = filename.split(".").pop() ?? "unknown";
    throw new UnsupportedFileTypeError(extension);
  }

  try {
    switch (fileType) {
      case "pdf":
        return await extractPdfText(buffer);
      case "docx":
        return await extractDocxText(buffer);
      case "txt":
        return extractTxtText(buffer);
    }
  } catch (error) {
    if (error instanceof UnsupportedFileTypeError) {
      throw error;
    }
    throw new FileExtractionError(fileType, error);
  }
}
