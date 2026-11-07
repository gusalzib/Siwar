# Use an official Node.js Slim image (Debian-based) for stable native module (sharp, bcrypt) and Vite bundling compatibility
FROM node:22-slim AS builder

# Create app directory
WORKDIR /app

# Allocate sufficient memory for Vite/Nuxt client bundling
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy package file
COPY package.json ./

# Install all dependencies (needed for the build step)
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate Nuxt virtual templates and types from the actual nuxt.config.ts and modules
RUN npx nuxi prepare

# Build the Nuxt application (generates .output directory)
RUN npx nuxi build

# --- Production Image ---
FROM node:22-slim AS runner

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
