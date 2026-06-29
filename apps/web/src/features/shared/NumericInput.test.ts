import { describe, expect, it } from "vitest";
import { parseNumericInput } from "./NumericInput";

describe("parseNumericInput", () => {
  it("accepts decimal and abbreviated values", () => {
    expect(parseNumericInput("3.52m")).toBe(3_520_000);
    expect(parseNumericInput("3,5 k")).toBe(3_500);
    expect(parseNumericInput("18.1")).toBe(18.1);
    expect(parseNumericInput("oops")).toBeNull();
  });
});
