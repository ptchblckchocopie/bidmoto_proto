# Frontend Dockerfile for SvelteKit
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Clean install dependencies (ensures correct native binaries for Alpine)
RUN npm ci

# Copy source code
COPY . .

# Generate SvelteKit types
RUN npx svelte-kit sync

# Expose port
EXPOSE 5173

# Start the application in development mode
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
