import mongoose from 'mongoose'
import { ensureDefaultCategory } from '../utils/defaultCategory'
import { ensureDefaultAdmin } from '../utils/defaultAdmin'

export default defineNitroPlugin(async (_nitroApp) => {
  const config = useRuntimeConfig()
  
  // Access MongoDB URI from runtime config or process.env fallbacks (Railway supports MONGO_URL, MONGODB_URL)
  const uri = (config.mongodbUri || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL || process.env.DATABASE_URL) as string

  if (!uri) {
    console.error('❌ MONGODB_URI is not set! Checked MONGODB_URI, MONGO_URL, MONGODB_URL, DATABASE_URL.')
    return
  }

  // Set up connection event listeners for maintaining the pool
  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected successfully')
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected. Mongoose will attempt to reconnect automatically...')
  })

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err)
  })

  let isConnecting = false

  const connectToDatabase = async () => {
    if (isConnecting || mongoose.connection.readyState === 1) return
    
    isConnecting = true
    try {
      console.log('Connecting to MongoDB...')
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      })

      // Lazy-initializers: ensure default fallback category and root admin exist in fresh databases
      try {
        await Promise.all([
          ensureDefaultCategory(),
          ensureDefaultAdmin(),
        ])
      } catch (seedErr) {
        console.error('Failed to run initial database seeds:', seedErr)
      }
    } catch (error) {
      console.error('❌ Error connecting to MongoDB:', error)
      setTimeout(connectToDatabase, 5000)
    } finally {
      isConnecting = false
    }
  }

  // Await the initial connection so the database is ready before serving incoming HTTP requests
  await connectToDatabase()
})
