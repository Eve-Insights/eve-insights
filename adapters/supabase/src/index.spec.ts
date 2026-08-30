import { describe, expect, it } from "vitest";
import {
  createSupabaseAdapter,
  PACKAGE_NAME,
  SupabaseAdapter,
  supabaseAdapterOptionsSchema,
  supabaseEnvSchema,
} from "./index.js";

describe("index", () => {
  it("re-exports the public adapter surface", () => {
    expect(PACKAGE_NAME).toBe("@eve-insights/adapter-supabase");
    expect(typeof createSupabaseAdapter).toBe("function");
    expect(SupabaseAdapter).toBeTypeOf("function");
    expect(supabaseAdapterOptionsSchema).toBeDefined();
    expect(supabaseEnvSchema).toBeDefined();
  });
});
