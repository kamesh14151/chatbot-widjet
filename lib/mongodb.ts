import { MongoClient, Db } from "mongodb";

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/scaletechschool";

const mongoOptions = {
  serverSelectionTimeoutMS: 3000,
  connectTimeoutMS: 3000,
};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

async function getClient(): Promise<MongoClient> {
  // Already connected
  if (client) {
    return client;
  }

  // Connection in progress
  if (clientPromise) {
    return clientPromise;
  }

  // Create new connection
  client = new MongoClient(uri, mongoOptions);

  clientPromise = client
    .connect()
    .then((connected) => {
      client = connected;
      return connected;
    })
    .catch((err) => {
      // VERY IMPORTANT
      clientPromise = null;
      client = null;
      throw err;
    });

  return clientPromise;
}

export async function getMongoDb(): Promise<Db | null> {
  try {
    const connected = await getClient();
    return connected.db();
  } catch (error) {
    console.warn(
      "Primary MongoDB connection timeout or error:",
      error instanceof Error ? error.message : error
    );

    if (uri.includes("161.248.37.193")) {
      try {
        const localClient = new MongoClient(
          "mongodb://127.0.0.1:27017/scaletechschool",
          mongoOptions
        );

        await localClient.connect();
        return localClient.db();
      } catch {}
    }

    return null;
  }
}