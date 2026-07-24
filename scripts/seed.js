const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/scaletechschool";

async function seed() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db();
        const users = db.collection('users');

        await users.createIndex({ email: 1 }, { unique: true });

        const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin', 10);
        const expertPassword = await bcrypt.hash(process.env.EXPERT_PASSWORD || 'expert', 10);

        const adminUser = {
            name: 'System Admin',
            username: 'admin',
            mobileNo: '0000000000',
            email: process.env.ADMIN_EMAIL || 'admin@sona.com',
            password: adminPassword,
            role: 'admin',
            authProvider: 'credentials',
            createdAt: new Date(),
        };

        const expertUser = {
            name: 'Admissions Expert',
            username: 'expert',
            mobileNo: '1111111111',
            email: process.env.EXPERT_EMAIL || 'expert@sona.com',
            password: expertPassword,
            role: 'expert',
            authProvider: 'credentials',
            createdAt: new Date(),
        };

        const r1 = await users.updateOne({ email: adminUser.email }, { $set: adminUser }, { upsert: true });
        const r2 = await users.updateOne({ email: expertUser.email }, { $set: expertUser }, { upsert: true });

        console.log("Users seeded successfully!", { admin: r1.upsertedId || 'updated', expert: r2.upsertedId || 'updated' });
    } catch (e) {
        console.error("Error seeding users:", e);
    } finally {
        await client.close();
    }
}

seed();
