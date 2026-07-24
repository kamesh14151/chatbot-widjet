import NextAuth, { DefaultSession, DefaultUser } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import AzureADProvider from "next-auth/providers/azure-ad"
import { getMongoDb } from "@/lib/mongodb"
import bcrypt from "bcrypt"

declare module "next-auth" {
    interface Session {
        user: {
            role?: string;
        } & DefaultSession["user"]
    }
    interface User extends DefaultUser {
        role?: string;
    }
}

const handler = NextAuth({
    providers: [
        AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID || "",
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
            tenantId: process.env.AZURE_AD_TENANT_ID || "",
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing email or password");
                }
                const db = await getMongoDb();
                if (!db) throw new Error("Database error");

                const users = db.collection('users');
                const user = await users.findOne({ email: credentials.email });

                if (!user || !user.password) {
                    throw new Error("Invalid email or password");
                }

                const isValid = await bcrypt.compare(credentials.password, user.password);
                if (!isValid) {
                    throw new Error("Invalid email or password");
                }

                return {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    role: user.role
                };
            }
        })
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            // For Azure AD login
            if (account?.provider === 'azure-ad') {
                const db = await getMongoDb();
                if (!db) return false;
                
                // Check if user is whitelisted in DB
                const users = db.collection('users');
                const dbUser = await users.findOne({ email: user.email });
                
                if (dbUser) {
                    user.role = dbUser.role; // Attach role to user object
                    return true;
                }
                
                // If not found in DB, register as pending
                const newUser = {
                    name: user.name,
                    email: user.email,
                    role: 'pending',
                    authProvider: 'azure-ad',
                    createdAt: new Date().toISOString()
                };
                await users.insertOne(newUser);
                user.role = 'pending';
                
                // Send emails asynchronously
                const { sendEmail } = await import('@/lib/email');
                
                sendEmail(
                    user.email as string, 
                    user.name || 'User', 
                    'You are on the waitlist for SONA SCALE',
                    `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Welcome to SONA SCALE</h2>
                        <p>Hi ${user.name || 'there'},</p>
                        <p>Thank you for registering. Your account is currently <strong>pending approval</strong> by an administrator.</p>
                        <p>You will be notified once you are granted access to the dashboard.</p>
                    </div>
                    `
                ).catch(console.error);

                const { readEmailConfigAsync } = await import('@/app/api/admin/email-config/route');
                readEmailConfigAsync().then(cfg => {
                    const notifyEmail = cfg.waitlistEmailTo || cfg.leadEmailTo;
                    if (notifyEmail) {
                        sendEmail(
                            notifyEmail,
                            'Admin',
                            'New User Registration (Action Required)',
                            `
                            <div style="font-family: Arial, sans-serif; padding: 20px;">
                                <h2>New Waitlist Registration</h2>
                                <p>A new user has signed in via Microsoft.</p>
                                <p><strong>Name:</strong> ${user.name}</p>
                                <p><strong>Email:</strong> ${user.email}</p>
                                <p>Please log in to the Admin Dashboard to approve their access.</p>
                            </div>
                            `
                        ).catch(console.error);
                    }
                }).catch(console.error);

                return true; 
            }
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as string;
            }
            return session;
        }
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: "jwt"
    },
    secret: process.env.NEXTAUTH_SECRET || "fallback_secret_key"
})

export { handler as GET, handler as POST }
