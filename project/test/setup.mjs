/**
 * Test environment bootstrap — shared by every backend test.
 *
 * Responsibilities:
 *   1. Spin up an in-process MongoDB (`mongodb-memory-server`) so tests run
 *      hermetically and never touch the developer's Atlas cluster.
 *   2. Override env vars that the application code reads at module-load time
 *      (e.g. `TRAVEL_DOC_SECRET` so the prod hard-fail doesn't trip in CI).
 *   3. Connect mongoose to the ephemeral server.
 *   4. Reset every collection between tests so suites can't leak state.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

// Set env vars BEFORE the app module is loaded. Test files import the app
// after the global setup hooks run, so this ordering is critical.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.TRAVEL_DOC_SECRET = process.env.TRAVEL_DOC_SECRET
    || 'test-only-deterministic-secret-not-used-anywhere-else';

let mongo;

beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri, { dbName: 'scholarshipzone-test' });
}, 120_000);

afterEach(async () => {
    if (mongoose.connection.readyState !== 1) return;
    const { collections } = mongoose.connection;
    await Promise.all(
        Object.values(collections).map((c) => c.deleteMany({}))
    );
});

afterAll(async () => {
    await mongoose.disconnect().catch(() => {});
    if (mongo) await mongo.stop();
});
