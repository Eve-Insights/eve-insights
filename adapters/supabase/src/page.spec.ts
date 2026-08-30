import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "./fake-client.js";
import { selectAll } from "./page.js";

describe("selectAll", () => {
  it("pages until a short result is returned", async () => {
    const fake = createFakeSupabaseClient();
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      run_id: `run-${index}`,
    }));
    fake.tables.set("eval_runs", rows);

    const selected = await selectAll(
      {
        client: fake as unknown as SupabaseClient,
        maxChunkBytes: 128,
      },
      "eval_runs",
    );

    expect(selected).toHaveLength(1001);
  });
});
