# Use an official Node.js Alpine image for a small footprint
FROM node:22-alpine AS builder

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (needed for the build step)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Nuxt application (generates .output directory)
RUN npm run build

# --- Production Image ---
FROM node:22-alpine AS runner

WORKDIR /app

# Copy only the built Nitro output from the builder stage
COPY --from=builder /app/.output ./.output

# Set Node.js memory flag and environment to production
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Expose the port Nitro runs on (default 3000)
EXPOSE 3000

# Start the application using the Nitro entrypoint
CMD ["node", ".output/server/index.mjs"]
