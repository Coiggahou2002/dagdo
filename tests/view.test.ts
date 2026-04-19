import { describe, it, expect } from "bun:test";
import { wrapSvgInHtml } from "../src/commands/view";

describe("wrapSvgInHtml", () => {
  it("embeds the SVG inside a full HTML document", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const html = wrapSvgInHtml(svg);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<title>dagdo graph</title>");
    expect(html).toContain(svg);
  });

  it("does not double-escape SVG contents", () => {
    // Arbitrary valid SVG-y characters (quotes, ampersands) must pass through
    // unchanged so the browser renders them, rather than being HTML-escaped.
    const svg = '<svg><text font-family="Georgia">A &amp; B</text></svg>';
    const html = wrapSvgInHtml(svg);
    expect(html).toContain(svg);
  });
});
