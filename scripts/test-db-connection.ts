import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
dotenv.config({ path: resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function testConnection() {
    console.log('🔄 Testing MongoDB connection...\n');

    if (!MONGODB_URI) {
        console.error('❌ Error: MONGODB_URI is not defined in .env file');
        console.log('Please set your MongoDB connection string in .env file');
        process.exit(1);
    }

    console.log(`📍 Connection URI: ${MONGODB_URI.replace(/:[^:]*@/, ':****@')}`);

    try {
        console.log('\n⏳ Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000, // 5 seconds timeout
        });

        console.log('✅ Successfully connected to MongoDB!\n');

        // Get connection info
        const connection = mongoose.connection;
        console.log('📊 Connection Details:');
        if (connection.db) {
            console.log(`   - Database: ${connection.db.databaseName}`);
        }
        console.log(`   - Host: ${connection.host}`);
        console.log(`   - Port: ${connection.port}`);
        console.log(`   - Ready State: ${connection.readyState === 1 ? 'Connected' : 'Not Connected'}`);

        // Test a simple operation
        console.log('\n🧪 Testing database operation...');
        if (connection.db) {
            const collections = await connection.db.listCollections().toArray();
            console.log(`   - Found ${collections.length} collection(s)`);
            if (collections.length > 0) {
                console.log('   - Collections:', collections.map(c => c.name).join(', '));
            }
        }

        console.log('\n✅ All tests passed! Database connection is working properly.\n');

        // Close connection
        await mongoose.connection.close();
        console.log('🔌 Connection closed.');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Connection failed!');
        if (error instanceof Error) {
            console.error('Error:', error.message);
            
            if (error.message.includes('ECONNREFUSED')) {
                console.log('\n💡 Tip: Make sure MongoDB is running on your local machine');
                console.log('   Or use a MongoDB Atlas connection string instead');
            } else if (error.message.includes('authentication')) {
                console.log('\n💡 Tip: Check your MongoDB username and password');
            } else if (error.message.includes('timeout')) {
                console.log('\n💡 Tip: Check your network connection or MongoDB server status');
            } else if (error.message.includes('bad auth')) {
                console.log('\n💡 Tip: Authentication failed - verify your username and password');
            }
        }
        process.exit(1);
    }
}

testConnection();
