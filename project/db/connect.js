const mongoose = require('mongoose');

let connectingPromise = null;

const getConnectionString = () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error(
            'MONGODB_URI is not set. Create project/.env from .env.example and paste your Atlas connection string.'
        );
    }
    return uri;
};

const connectDb = async () => {
    if (mongoose.connection.readyState === 1) return mongoose.connection;
    if (connectingPromise) return connectingPromise;

    const uri = getConnectionString();
    const dbName = process.env.MONGODB_DB_NAME || undefined;

    mongoose.set('strictQuery', true);

    connectingPromise = mongoose
        .connect(uri, { dbName, serverSelectionTimeoutMS: 15000 })
        .then((m) => {
            console.log(`[db] Connected to MongoDB (${m.connection.name})`);
            return m.connection;
        })
        .catch((err) => {
            connectingPromise = null;
            throw err;
        });

    return connectingPromise;
};

const disconnectDb = async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
};

module.exports = { connectDb, disconnectDb, mongoose };
