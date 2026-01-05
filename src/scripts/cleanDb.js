require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/config');

async function cleanDatabase() {
    try {
        await mongoose.connect(config.mongodb.uri);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        for (const collection of collections) {
            const collectionName = collection.name;

            // Skip system collections
            if (collectionName.startsWith('system.')) {
                console.log(`Skipping system collection: ${collectionName}`);
                continue;
            }

            const col = db.collection(collectionName);

            // Check if this is the admins collection - skip entirely
            if (collectionName.toLowerCase() === 'admins') {
                console.log(`Skipping admins collection entirely`);
                continue;
            }

            // Delete all documents from other collections
            const result = await col.deleteMany({});
            console.log(`Deleted ${result.deletedCount} documents from ${collectionName}`);
        }

        console.log('\nDatabase cleanup complete!');
    } catch (error) {
        console.error('Error cleaning database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

cleanDatabase();
