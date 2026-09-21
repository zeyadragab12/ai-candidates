import { NextResponse } from "next/server";

import { extractTextFromFile } from "@/lib/files/extract";
import { requireUser } from "@/lib/api/requireUser";
import { withErrorHandling } from "@/lib/errors";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const POST = withErrorHandling(async (request: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file was provided." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 10MB." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromFile(buffer, file.name);
  return NextResponse.json({ text });
});
