import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("openai", async () => {
  const actual = await vi.importActual<typeof import("openai")>("openai");
  const OpenAIMock = vi.fn().mockImplementation(function (this: {
    chat: { completions: { create: typeof createMock } };
  }) {
    this.chat = { completions: { create: createMock } };
  });
  return { ...actual, default: OpenAIMock };
});

const { APIError } = await import("openai");
const { OpenAIProvider } = await import("./OpenAIProvider");
const { AIProviderError } = await import("./AIProvider");

function apiError(status: number, message: string) {
  return new APIError(status, { error: { message } }, message, new Headers());
}

describe("OpenAIProvider", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("returns the generated text on success", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "hello" } }] });
    const provider = new OpenAIProvider("test-key");

    const result = await provider.generateText("prompt");
    expect(result).toBe("hello");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("retries a retryable APIError (e.g. 429) and succeeds", async () => {
    createMock
      .mockRejectedValueOnce(apiError(429, "rate limited"))
      .mockResolvedValueOnce({ choices: [{ message: { content: "hello" } }] });
    const provider = new OpenAIProvider("test-key");

    const result = await provider.generateText("prompt");
    expect(result).toBe("hello");
    expect(createMock).toHaveBeenCalledTimes(2);
  }, 15000);

  it("does not retry a non-retryable APIError (e.g. 400) and wraps it", async () => {
    createMock.mockRejectedValue(apiError(400, "bad request"));
    const provider = new OpenAIProvider("test-key");

    await expect(provider.generateText("prompt")).rejects.toThrow(AIProviderError);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting retries on a persistent 503 and wraps as AIProviderError", async () => {
    createMock.mockRejectedValue(apiError(503, "unavailable"));
    const provider = new OpenAIProvider("test-key");

    await expect(provider.generateText("prompt")).rejects.toThrow(AIProviderError);
    expect(createMock).toHaveBeenCalledTimes(5);
  }, 30000);

  it("wraps an empty response as an AIProviderError without retrying forever", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "" } }] });
    const provider = new OpenAIProvider("test-key");

    await expect(provider.generateText("prompt")).rejects.toThrow(AIProviderError);
    expect(createMock).toHaveBeenCalledTimes(5);
  }, 30000);

  it("passes model, system instruction, and json response_format through", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "hello" } }] });
    const provider = new OpenAIProvider("test-key", "gpt-5.6-luna");

    await provider.generateText("prompt", {
      systemInstruction: "be terse",
      temperature: 0.4,
      jsonMode: true,
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-luna",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "be terse" },
          { role: "user", content: "prompt" },
        ],
      }),
    );
  });

  it("never forwards temperature — this model family 400s on any non-default value", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "hello" } }] });
    const provider = new OpenAIProvider("test-key");

    await provider.generateText("prompt", { temperature: 0.2 });

    const call = createMock.mock.calls[0]?.[0];
    expect(call).not.toHaveProperty("temperature");
  });

  it("omits the system message entirely when no systemInstruction is given", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "hello" } }] });
    const provider = new OpenAIProvider("test-key");

    await provider.generateText("prompt");

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "prompt" }],
      }),
    );
  });
});
