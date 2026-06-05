import { describe, expect, it } from "vitest";
import { convertMessages, convertToolOutputs, normalizeContentPart } from "../src/index";

// Pi's native binary-content shape and its LangChain v1 equivalent.
const piImage = { type: "image", mimeType: "image/png", data: "iVBORw0KGgoBASE64" };
const lcImage = { type: "image", mime_type: "image/png", base64: "iVBORw0KGgoBASE64" };

describe("normalizeContentPart", () => {
  it("converts a pi image part to the LangChain v1 shape", () => {
    expect(normalizeContentPart(piImage)).toEqual(lcImage);
  });

  it("converts other multimodal kinds (audio/file/video) the same way", () => {
    expect(normalizeContentPart({ type: "audio", mimeType: "audio/mp3", data: "AAA" })).toEqual({
      type: "audio",
      mime_type: "audio/mp3",
      base64: "AAA",
    });
  });

  it("passes text parts through unchanged", () => {
    const text = { type: "text", text: "hello" };
    expect(normalizeContentPart(text)).toBe(text);
  });

  it("leaves malformed/partial image parts untouched", () => {
    expect(normalizeContentPart({ type: "image" })).toEqual({ type: "image" });
    expect(normalizeContentPart({ type: "image", mimeType: "image/png" })).toEqual({
      type: "image",
      mimeType: "image/png",
    });
    expect(normalizeContentPart("plain string")).toBe("plain string");
  });
});

describe("convertMessages", () => {
  it("normalizes image parts in user message content", () => {
    const [out] = convertMessages([
      { role: "user", content: [{ type: "text", text: "look at this" }, piImage] },
    ] as never);

    expect(out.content).toEqual([{ type: "text", text: "look at this" }, lcImage]);
  });

  it("maps toolResult to role 'tool' and normalizes image content (the `read` tool path)", () => {
    const [out] = convertMessages([
      {
        role: "toolResult",
        toolName: "read",
        content: [{ type: "text", text: "Read image file [image/png]" }, piImage],
      },
    ] as never);

    expect(out.role).toBe("tool");
    expect(out.content).toEqual([{ type: "text", text: "Read image file [image/png]" }, lcImage]);
  });

  it("leaves string user content untouched", () => {
    const [out] = convertMessages([{ role: "user", content: "just text" }] as never);
    expect(out.content).toBe("just text");
  });

  it("still converts assistant tool calls and never sees images there", () => {
    const [out] = convertMessages([
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "1", name: "read", arguments: { path: "a.png" } }],
      },
    ] as never);

    expect(out.content).toEqual([
      { type: "tool_call", id: "1", name: "read", args: { path: "a.png" } },
    ]);
  });
});

describe("convertToolOutputs", () => {
  it("normalizes image parts in tool result content", () => {
    const out = convertToolOutputs({
      result: { content: [{ type: "text", text: "Read image file" }, piImage] },
    });

    expect(out).toEqual({
      output: { role: "tool", content: [{ type: "text", text: "Read image file" }, lcImage] },
    });
  });

  it("passes through non-record results", () => {
    expect(convertToolOutputs({ result: "ok" })).toEqual({ output: "ok" });
  });
});
