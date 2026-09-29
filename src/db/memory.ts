// In-memory MongoDB-compatible fallback store.
//
// The SIH demo must run with zero secrets. When MONGODB_URL is missing (or the
// cluster is unreachable) every persistence API silently switches to this tiny
// store instead of throwing "MONGODB_URL is not configured", which used to show
// up on the /talk screen as "conversation error".
//
// It implements only the small slice of the driver surface the app uses:
//   insertOne / insertMany / findOne / updateOne / deleteMany
//   find(filter).sort().limit().project().toArray()
//   countDocuments() / aggregate([$match,$group,$sort,$limit,$project])
import { ObjectId } from "mongodb";

type Doc = Record<string, unknown>;

const globalForMem = globalThis as typeof globalThis & {
  _jsMemoryDb?: Map<string, Doc[]>;
};

function store(): Map<string, Doc[]> {
  if (!globalForMem._jsMemoryDb) globalForMem._jsMemoryDb = new Map();
  return globalForMem._jsMemoryDb;
}

const idOf = (v: unknown): string =>
  v && typeof v === "object" && "toString" in (v as object) ? String(v) : String(v);

/** structuredClone drops the ObjectId prototype — keep the original instance. */
function cloneDoc(doc: Doc): Doc {
  const { _id, ...rest } = doc;
  return { ...structuredClone(rest), _id } as Doc;
}

function get(path: string, doc: Doc): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Doc)[k];
    return undefined;
  }, doc);
}

function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter ?? {}).every(([k, v]) => {
    const actual = k === "_id" ? idOf(doc._id) : get(k, doc);
    if (k === "_id") return idOf(v) === actual;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const ops = v as Doc;
      if ("$eq" in ops) return actual === ops.$eq;
      if ("$ne" in ops) return actual !== ops.$ne;
      if ("$in" in ops) return Array.isArray(ops.$in) && (ops.$in as unknown[]).includes(actual);
      if ("$exists" in ops) return (actual !== undefined) === Boolean(ops.$exists);
      return JSON.stringify(actual) === JSON.stringify(v);
    }
    return actual === v;
  });
}

function setPath(doc: Doc, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Doc = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k] as Doc;
  }
  cur[parts[parts.length - 1]] = value;
}

function project(doc: Doc, spec: Doc | null): Doc {
  if (!spec) return doc;
  const keys = Object.keys(spec).filter((k) => spec[k]);
  if (!keys.length) return doc;
  const out: Doc = {};
  if (!("_id" in spec) || spec._id) out._id = doc._id;
  for (const k of keys) if (k !== "_id") out[k] = get(k, doc);
  return out;
}

class MemCursor {
  constructor(private rows: Doc[], private _projection: Doc | null = null) {}
  sort(spec: Doc) {
    const [[key, dir] = ["_id", 1]] = Object.entries(spec ?? {});
    const d = Number(dir) < 0 ? -1 : 1;
    this.rows = [...this.rows].sort((a, b) => {
      const av = get(key, a) as number | string | Date | undefined;
      const bv = get(key, b) as number | string | Date | undefined;
      if (av === bv) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return (av > bv ? 1 : -1) * d;
    });
    return this;
  }
  limit(n: number) { this.rows = this.rows.slice(0, n); return this; }
  skip(n: number) { this.rows = this.rows.slice(n); return this; }
  project(spec: Doc) { this._projection = spec; return this; }
  async toArray(): Promise<Doc[]> {
    return this.rows.map((r) => project(cloneDoc(r), this._projection));
  }
}

function groupKey(spec: unknown, doc: Doc): unknown {
  if (spec === null) return null;
  if (typeof spec === "string" && spec.startsWith("$")) return get(spec.slice(1), doc) ?? null;
  if (spec && typeof spec === "object") {
    const out: Doc = {};
    for (const [k, v] of Object.entries(spec as Doc)) out[k] = groupKey(v, doc);
    return out;
  }
  return spec;
}

class MemCollection {
  constructor(private name: string) {}
  private rows(): Doc[] {
    const s = store();
    if (!s.has(this.name)) s.set(this.name, []);
    return s.get(this.name)!;
  }

  async insertOne(doc: Doc) {
    const _id = (doc._id as ObjectId | undefined) ?? new ObjectId();
    this.rows().push({ ...cloneDoc(doc), _id });
    return { acknowledged: true, insertedId: _id };
  }

  async insertMany(docs: Doc[]) {
    const ids: ObjectId[] = [];
    for (const d of docs) {
      const r = await this.insertOne(d);
      ids.push(r.insertedId as ObjectId);
    }
    return { acknowledged: true, insertedCount: ids.length, insertedIds: ids };
  }

  async findOne(filter: Doc = {}) {
    const hit = this.rows().find((r) => matches(r, filter));
    return hit ? cloneDoc(hit) : null;
  }

  find(filter: Doc = {}) {
    return new MemCursor(this.rows().filter((r) => matches(r, filter)));
  }

  async updateOne(filter: Doc, update: Doc, opts: { upsert?: boolean } = {}) {
    const rows = this.rows();
    const idx = rows.findIndex((r) => matches(r, filter));
    if (idx === -1) {
      if (opts.upsert) {
        await this.insertOne({ ...(update.$set as Doc ?? {}) });
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    }
    const doc = rows[idx];
    for (const [k, v] of Object.entries((update.$set as Doc) ?? {})) setPath(doc, k, structuredClone(v));
    for (const [k, v] of Object.entries((update.$inc as Doc) ?? {})) {
      setPath(doc, k, Number(get(k, doc) ?? 0) + Number(v));
    }
    if (!update.$set && !update.$inc && !update.$unset) {
      rows[idx] = { ...cloneDoc(update), _id: doc._id };
    }
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async deleteMany(filter: Doc = {}) {
    const rows = this.rows();
    const keep = rows.filter((r) => !matches(r, filter));
    const removed = rows.length - keep.length;
    store().set(this.name, keep);
    return { acknowledged: true, deletedCount: removed };
  }

  async countDocuments(filter: Doc = {}) {
    return this.rows().filter((r) => matches(r, filter)).length;
  }

  aggregate(pipeline: Doc[] = []) {
    let rows = this.rows().map((r) => cloneDoc(r));
    for (const stage of pipeline) {
      if (stage.$match) rows = rows.filter((r) => matches(r, stage.$match as Doc));
      else if (stage.$group) {
        const spec = stage.$group as Doc;
        const buckets = new Map<string, Doc>();
        for (const r of rows) {
          const key = groupKey(spec._id, r);
          const sig = JSON.stringify(key ?? null);
          if (!buckets.has(sig)) buckets.set(sig, { _id: key });
          const b = buckets.get(sig)!;
          for (const [field, acc] of Object.entries(spec)) {
            if (field === "_id" || !acc || typeof acc !== "object") continue;
            const a = acc as Doc;
            if ("$sum" in a) {
              const add = typeof a.$sum === "string" && a.$sum.startsWith("$")
                ? Number(get((a.$sum as string).slice(1), r) ?? 0)
                : Number(a.$sum);
              b[field] = Number(b[field] ?? 0) + (Number.isFinite(add) ? add : 0);
            } else if ("$push" in a) {
              const val = typeof a.$push === "string" && (a.$push as string).startsWith("$")
                ? get((a.$push as string).slice(1), r)
                : a.$push;
              b[field] = [...((b[field] as unknown[]) ?? []), val];
            }
          }
        }
        rows = [...buckets.values()];
      } else if (stage.$sort) {
        const [[key, dir]] = Object.entries(stage.$sort as Doc);
        const d = Number(dir) < 0 ? -1 : 1;
        rows.sort((a, b) => {
          const av = get(key, a) as number;
          const bv = get(key, b) as number;
          return av === bv ? 0 : (av > bv ? 1 : -1) * d;
        });
      } else if (stage.$limit) rows = rows.slice(0, Number(stage.$limit));
      else if (stage.$project) rows = rows.map((r) => project(r, stage.$project as Doc));
    }
    return new MemCursor(rows);
  }
}

export interface MemoryDb {
  collection: (name: string) => MemCollection;
  command: (cmd: Doc) => Promise<Doc>;
  isMemory: true;
}

export function memoryDb(): MemoryDb {
  const cols = new Map<string, MemCollection>();
  return {
    collection(name: string) {
      if (!cols.has(name)) cols.set(name, new MemCollection(name));
      return cols.get(name)!;
    },
    async command() { return { ok: 1, storage: "in-memory" }; },
    isMemory: true,
  };
}
