import { describe, expect, it } from "vitest";
import { FakeFirestore } from "./fake-firestore.js";

describe("fake-firestore", () => {
  it("merges, replaces, and lists only direct children", async () => {
    const client = new FakeFirestore();
    const run = client.collection("evalRuns").doc("run");
    await run.set({ name: "first" });
    await run.set({ extra: true }, { merge: true });
    expect((await run.get()).data()).toEqual({ name: "first", extra: true });
    await run.set({ name: "replaced" });
    expect((await run.get()).data()).toEqual({ name: "replaced" });

    await run.collection("events").doc("event").set({ type: "run.started" });
    await run
      .collection("events")
      .doc("event")
      .collection("chunks")
      .doc("0")
      .set({ index: 0 });

    const events = await run.collection("events").get();
    expect(events.docs.map((document) => document.ref.id)).toEqual(["event"]);
    expect(
      (await client.collection("evalRuns").doc("missing").get()).exists,
    ).toBe(false);

    const empty = await client.collection("missing").get();
    expect(empty.docs).toEqual([]);

    const batch = client.batch();
    batch.set(client.collection("evalRuns").doc("batched"), { ok: true });
    batch.set(
      client.collection("evalRuns").doc("batched"),
      { extra: true },
      { merge: true },
    );
    await batch.commit();
    expect(client.store.get("evalRuns/batched")).toEqual({
      ok: true,
      extra: true,
    });

    await client.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(
        client.collection("evalRuns").doc("batched"),
      );
      transaction.set(
        client.collection("evalRuns").doc("batched"),
        { via: "tx" },
        { merge: true },
      );
      expect(snapshot.data()).toMatchObject({ ok: true });
    });
    expect(client.store.get("evalRuns/batched")).toEqual({
      ok: true,
      extra: true,
      via: "tx",
    });

    await client
      .collection("evalRuns")
      .doc("fresh-merge")
      .set({ created: true }, { merge: true });
    expect(client.store.get("evalRuns/fresh-merge")).toEqual({ created: true });

    await run.delete();
    expect((await run.get()).exists).toBe(false);

    let ranHook = false;
    client.beforeTransaction = () => {
      ranHook = true;
    };
    await client.runTransaction(async () => undefined);
    expect(ranHook).toBe(true);

    await expect(
      client.runTransaction(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(client.runTransaction(async () => "recovered")).resolves.toBe(
      "recovered",
    );
  });
});
