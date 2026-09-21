import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseJsonResponse } from "./parseJsonResponse";
import { AIResponseValidationError } from "./AIProvider";

const schema = z.object({ name: z.string(), age: z.number() });

describe("parseJsonResponse", () => {
  it("parses valid raw JSON", () => {
    const result = parseJsonResponse(
      '{"name":"Ada","age":30}',
      schema,
      "test",
    );
    expect(result).toEqual({ name: "Ada", age: 30 });
  });

  it("strips markdown json code fences before parsing", () => {
    const result = parseJsonResponse(
      '```json\n{"name":"Ada","age":30}\n```',
      schema,
      "test",
    );
    expect(result).toEqual({ name: "Ada", age: 30 });
  });

  it("strips plain markdown code fences (no json language tag)", () => {
    const result = parseJsonResponse(
      '```\n{"name":"Ada","age":30}\n```',
      schema,
      "test",
    );
    expect(result).toEqual({ name: "Ada", age: 30 });
  });

  it("throws AIResponseValidationError for invalid JSON syntax", () => {
    expect(() =>
      parseJsonResponse("this is not json at all", schema, "test"),
    ).toThrow(AIResponseValidationError);
  });

  it("throws AIResponseValidationError when JSON doesn't match the schema", () => {
    expect(() =>
      parseJsonResponse('{"name":"Ada"}', schema, "test"),
    ).toThrow(AIResponseValidationError);
  });

  it("throws AIResponseValidationError for valid JSON of the wrong shape (e.g. an array)", () => {
    expect(() => parseJsonResponse("[1,2,3]", schema, "test")).toThrow(
      AIResponseValidationError,
    );
  });
});
