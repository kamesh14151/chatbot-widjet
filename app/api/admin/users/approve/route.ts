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

        const { userId, role } = await req.json();

        if (!userId || !role || !['admin', 'expert'].includes(role)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const db = await getMongoDb();
        if (!db) {
            return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }

        const usersCollection = db.collection('users');
        
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { role: role } }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: `User approved as ${role}` });
    } catch (error) {
        console.error("Error approving user:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
