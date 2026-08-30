type StoredData = Record<string, unknown>;

export class FakeSnapshot {
  readonly exists: boolean;

  constructor(private readonly value: StoredData | undefined) {
    this.exists = value !== undefined;
  }

  data(): StoredData | undefined {
    return this.value;
  }
}

export class FakeRef {
  readonly id: string;

  constructor(
    private readonly store: Map<string, StoredData>,
    readonly path: string,
  ) {
    this.id = path.slice(path.lastIndexOf("/") + 1);
  }

  get(): Promise<FakeSnapshot> {
    return Promise.resolve(new FakeSnapshot(this.store.get(this.path)));
  }

  set(data: StoredData, options?: { merge?: boolean }): Promise<void> {
    const value = options?.merge
      ? { ...(this.store.get(this.path) ?? {}), ...data }
      : data;
    this.store.set(this.path, value);
    return Promise.resolve();
  }

  delete(): Promise<void> {
    this.store.delete(this.path);
    return Promise.resolve();
  }

  collection(name: string): FakeCollection {
    return new FakeCollection(this.store, `${this.path}/${name}`);
  }
}

export class FakeCollection {
  constructor(
    private readonly store: Map<string, StoredData>,
    readonly path: string,
  ) {}

  doc(id: string): FakeRef {
    return new FakeRef(this.store, `${this.path}/${id}`);
  }

  get(): Promise<{
    docs: {
      readonly exists: boolean;
      readonly ref: FakeRef;
      data(): StoredData | undefined;
    }[];
  }> {
    const prefix = `${this.path}/`;
    const docs = [...this.store.entries()]
      .filter(
        ([path]) =>
          path.startsWith(prefix) && !path.slice(prefix.length).includes("/"),
      )
      .map(([path, value]) => ({
        ref: new FakeRef(this.store, path),
        exists: true,
        data: () => value,
      }));
    return Promise.resolve({ docs });
  }
}

export class FakeBatch {
  readonly operations: Array<{
    readonly ref: FakeRef;
    readonly data: StoredData;
  }> = [];

  set(
    ref: FakeRef,
    data: StoredData,
    options?: { merge?: boolean },
  ): FakeBatch {
    this.operations.push({ ref, data });
    void ref.set(data, options);
    return this;
  }

  commit(): Promise<void> {
    return Promise.resolve();
  }
}

export class FakeTransaction {
  get(ref: FakeRef): Promise<FakeSnapshot> {
    return ref.get();
  }

  set(
    ref: FakeRef,
    data: StoredData,
    options?: { merge?: boolean },
  ): FakeTransaction {
    void ref.set(data, options);
    return this;
  }
}

export class FakeFirestore {
  readonly store = new Map<string, StoredData>();
  beforeTransaction?: () => void | Promise<void>;
  private transactionTail = Promise.resolve();

  collection(name: string): FakeCollection {
    return new FakeCollection(this.store, name);
  }

  batch(): FakeBatch {
    return new FakeBatch();
  }

  async runTransaction<T>(
    callback: (transaction: FakeTransaction) => Promise<T>,
  ): Promise<T> {
    const run = this.transactionTail.then(async () => {
      await this.beforeTransaction?.();
      return callback(new FakeTransaction());
    });
    this.transactionTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
