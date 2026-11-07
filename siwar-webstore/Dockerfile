# Use an official Node.js Alpine image for a small footprint
FROM node:22-alpine AS builder

# Create app directory
WORKDIR /app

# Copy package file
COPY package.json ./

# Install all dependencies (needed for the build step)
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate Nuxt virtual templates and types from the actual nuxt.config.ts and modules
RUN npx nuxi prepare

# Build the Nuxt application (generates .output directory)
RUN npm run build

# --- Production Image ---
FROM node:22-alpine AS runner

WORKDIR /app

# Copy only the built Nitro output from the builder stage
COPY --from=builder /app/.output ./.output

# Set Node.js memory flag and environment to production
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Expose the port Nitro runs on (default 3000)
EXPOSE 3000

# Start the application using the Nitro entrypoint
CMD ["node", ".output/server/index.mjs"]
