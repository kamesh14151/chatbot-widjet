import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getToken } from 'next-auth/jwt';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
    try {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || "fallback_secret_key" });
        if (!token || token.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { userId, email } = await req.json();

        if (!userId || !email) {
            return NextResponse.json({ error: 'User ID and new email are required' }, { status: 400 });
        }

        const db = await getMongoDb();
        if (!db) {
            return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }

        const usersCollection = db.collection('users');
        
        // Check if email is already taken
        const existing = await usersCollection.findOne({ email, _id: { $ne: new ObjectId(userId) } });
        if (existing) {
            return NextResponse.json({ error: 'Email is already in use by another account' }, { status: 400 });
        }

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { email } }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Email updated successfully' });
    } catch (error) {
        console.error("Error updating user:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
