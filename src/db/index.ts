import { MongoClient, type Db } from "mongodb";
import { memoryDb, type MemoryDb } from "./memory";

const uri = process.env.MONGODB_URL;
const dbName = process.env.MONGODB_DB ?? "jeevikasetu";

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
  _memoryDb?: MemoryDb;
  _memoryWarned?: boolean;
};

function getClientPromise(): Promise<MongoClient> {
  if (!uri) return Promise.reject(new Error("MONGODB_URL is not configured"));
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
    globalForMongo._mongoClientPromise = client.connect().catch((e) => {
      // allow a later retry instead of caching a rejected promise forever
      globalForMongo._mongoClientPromise = undefined;
      throw e;
    });
  }
  return globalForMongo._mongoClientPromise;
}

function fallback(): MemoryDb {
  if (!globalForMongo._memoryDb) globalForMongo._memoryDb = memoryDb();
  if (!globalForMongo._memoryWarned) {
    globalForMongo._memoryWarned = true;
    console.warn(
      "[JeevikaSetu] MongoDB unavailable — using the in-memory demo store. " +
        "Set MONGODB_URL in .env.local for persistence.",
    );
  }
  return globalForMongo._memoryDb;
}

/**
 * Returns the MongoDB database when configured & reachable, otherwise a
 * drop-in in-memory store so the demo always works offline / key-less.
 */
export async function getDb(): Promise<Db> {
  if (!uri) return fallback() as unknown as Db;
  try {
    const client = await getClientPromise();
    return client.db(dbName);
  } catch {
    return fallback() as unknown as Db;
  }
}

export function isMemoryStore(): boolean {
  return !uri;
}

export default getClientPromise;
