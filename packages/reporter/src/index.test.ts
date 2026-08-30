import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("@eve-insights/reporter", () => {
  it("exposes its package name", () => {
    expect(PACKAGE_NAME).toBe("@eve-insights/reporter");
  });
});
