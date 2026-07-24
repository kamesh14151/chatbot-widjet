import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getToken } from 'next-auth/jwt';
import { ObjectId } from 'mongodb';

export async function DELETE(req: NextRequest) {
    try {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || "fallback_secret_key" });
        if (!token || token.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const db = await getMongoDb();
        if (!db) {
            return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }

        const usersCollection = db.collection('users');
        
        // Prevent deletion of default system accounts
        const userToDelete = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!userToDelete) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        
        if (userToDelete.email === 'admin@sona.com' || userToDelete.email === 'expert@sona.com') {
            return NextResponse.json({ error: 'Cannot delete default system accounts' }, { status: 403 });
        }

        const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
