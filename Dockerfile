# Stage 1: Build the Angular frontend
FROM node:20 AS frontend-builder
WORKDIR /app/frontend
COPY csv-comparison-tool/package*.json ./
RUN npm install
COPY csv-comparison-tool/ .
RUN npm run build

# Stage 2: Build the Node.js backend
FROM node:20 AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
# Install TypeScript globally and compile the code
RUN npm install -g typescript && \
    tsc --outDir dist/

# Stage 3: Production environment
FROM node:20-slim
WORKDIR /app

# Copy backend files
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/uploads ./backend/uploads

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist/csv-comparison-tool/browser ./frontend/dist

# Set working directory to backend
WORKDIR /app/backend

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "dist/server.js"]
