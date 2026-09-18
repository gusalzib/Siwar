import mongoose from 'mongoose'

export default defineNitroPlugin(async (_nitroApp) => {
  const config = useRuntimeConfig()
  
  // Access MongoDB URI from runtime config
  // The mongodbUri is defined in nuxt.config.ts 
  const uri = config.mongodbUri as string

  if (!uri) {
    console.warn('MONGODB_URI is not set. Mongoose connection skipped.')
    return
  }

  // Set up connection event listeners for maintaining the pool
  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected successfully')
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Mongoose will attempt to reconnect automatically...')
  })

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err)
  })

  let isConnecting = false

  const connectToDatabase = async () => {
    if (isConnecting || mongoose.connection.readyState === 1) return
    
    isConnecting = true
    try {
      console.log('Connecting to MongoDB Atlas...')
      await mongoose.connect(uri, {
        // Mongoose 6+ maintains its own connection pool by default.
        // We set a 5 second timeout for server selection.
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      })
    } catch (error) {
      console.error('Error connecting to MongoDB. Retrying in 5 seconds...', error)
      setTimeout(connectToDatabase, 5000)
    } finally {
      isConnecting = false
    }
  }

  // Initiate the connection (we don't await here to prevent blocking Nitro startup if DB is down)
  connectToDatabase()
})
