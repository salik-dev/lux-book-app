/**
 * In-memory stand-in for the parts of the Supabase client used by the contract
 * service. Supports the filter/terminal methods the service calls; joined selects
 * can be answered via `joins`.
 */

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

interface Result {
  data: unknown;
  error: { code?: string; message: string } | null;
}

export class FakeSupabase {
  readonly tables = new Map<string, Row[]>();
  readonly files = new Map<string, Uint8Array<ArrayBuffer>>();
  /** Answers for selects with embedded relations, keyed by table. */
  readonly joins = new Map<string, (row: Row) => Row>();
  /** Unique constraints: table -> list of column sets (with optional partial predicate). */
  readonly uniques = new Map<string, Array<{ columns: string[]; where?: Filter }>>();

  table(name: string): Row[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }

  from(name: string) {
    return new Query(this, name);
  }

  storage = {
    from: (bucket: string) => ({
      upload: (path: string, bytes: Uint8Array, opts: { upsert?: boolean }) => {
        const key = `${bucket}/${path}`;
        if (this.files.has(key) && !opts.upsert) {
          return Promise.resolve({ data: null, error: { message: "The resource already exists", statusCode: "409" } });
        }
        this.files.set(key, new Uint8Array(bytes));
        return Promise.resolve({ data: { path }, error: null });
      },
      download: (path: string) => {
        const bytes = this.files.get(`${bucket}/${path}`);
        return Promise.resolve(bytes ? { data: new Blob([bytes]), error: null } : { data: null, error: { message: "not found" } });
      },
      createSignedUrl: (path: string) =>
        Promise.resolve({ data: { signedUrl: `https://storage.test/${bucket}/${path}?token=x` }, error: null }),
    }),
  };
}

class Query implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private op: "select" | "update" | "insert" = "select";
  private patch: Row = {};
  private returning = false;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private max: number | null = null;
  private embedded = false;

  constructor(private readonly db: FakeSupabase, private readonly name: string) {}

  select(columns = "*") {
    if (this.op === "select") this.embedded = columns.includes("(");
    else this.returning = true;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.patch = row;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((r) => r[column] === value);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((r) => r[column] !== value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[column]));
    return this;
  }
  is(column: string, value: null) {
    this.filters.push((r) => (r[column] ?? null) === value);
    return this;
  }
  not(column: string, operator: string, value: unknown) {
    if (operator !== "is" || value !== null) throw new Error("fake: unsupported not()");
    this.filters.push((r) => (r[column] ?? null) !== null);
    return this;
  }
  order(column: string, opts: { ascending: boolean }) {
    this.orderBy = { column, ascending: opts.ascending };
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }

  private matches(): Row[] {
    let rows = this.db.table(this.name).filter((r) => this.filters.every((f) => f(r)));
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows = [...rows].sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1));
    }
    if (this.max !== null) rows = rows.slice(0, this.max);
    return rows;
  }

  private violatesUnique(candidate: Row, self?: Row): boolean {
    return (this.db.uniques.get(this.name) ?? []).some(({ columns, where }) =>
      (!where || where(candidate)) &&
      this.db.table(this.name).some((existing) =>
        existing !== self && (!where || where(existing)) && columns.every((c) => existing[c] === candidate[c])
      )
    );
  }

  private run(): Result {
    if (this.op === "insert") {
      const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...this.patch };
      if (this.violatesUnique(row)) return { data: null, error: { code: "23505", message: "duplicate key" } };
      this.db.table(this.name).push(row);
      return { data: [row], error: null };
    }
    const rows = this.matches();
    if (this.op === "update") {
      for (const row of rows) {
        if (this.violatesUnique({ ...row, ...this.patch }, row)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
      }
      for (const row of rows) Object.assign(row, this.patch, { updated_at: new Date().toISOString() });
      return { data: this.returning ? rows.map((r) => ({ ...r })) : null, error: null };
    }
    const join = this.embedded ? this.db.joins.get(this.name) : undefined;
    return { data: rows.map((r) => (join ? join(r) : { ...r })), error: null };
  }

  single(): Promise<Result> {
    const { data, error } = this.run();
    if (error) return Promise.resolve({ data: null, error });
    const rows = (data as Row[] | null) ?? [];
    if (rows.length !== 1) return Promise.resolve({ data: null, error: { code: "PGRST116", message: "not single" } });
    return Promise.resolve({ data: rows[0], error: null });
  }

  maybeSingle(): Promise<Result> {
    const { data, error } = this.run();
    if (error) return Promise.resolve({ data: null, error });
    const rows = (data as Row[] | null) ?? [];
    if (rows.length > 1) return Promise.resolve({ data: null, error: { code: "PGRST116", message: "multiple rows" } });
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}
