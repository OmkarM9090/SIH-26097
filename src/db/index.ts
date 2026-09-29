import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URL;
const dbName = process.env.MONGODB_DB ?? "jeevikasetu";

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

/** Lazily connect so `next build` and static pages work without secrets. */
function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("MONGODB_URL is not configured. Add it to .env.local before using persistence APIs.");
  }
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(uri);
    globalForMongo._mongoClientPromise = client.connect();
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  return client.db(dbName);
}

export default getClientPromise;
