import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
console.log(MONGODB_URI)
if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI environment variable');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then(mongoose => mongoose);
    console.log('Connected to Mongoose');
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;