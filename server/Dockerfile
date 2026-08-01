# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# Copy source code and prisma schema
COPY . .

# Generate Prisma client and compile TypeScript
# This matches the render.yaml buildCommand behaviour
# "prebuild": "prisma generate" runs automatically before "build": "tsc"
RUN npm run build

# Stage 2: Production image
FROM node:22-alpine

WORKDIR /app

# Install openssl for Prisma (needed on alpine)
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy built artifacts and prisma schema from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Generate prisma client for production
RUN npx prisma generate

# Expose the application port
EXPOSE 3001

# Set the start command
CMD ["npm", "start"]
