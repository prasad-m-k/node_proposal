# Use a Node.js base image
# We recommend using a specific stable version for production.
FROM node:20-slim

# Create application directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# Install production dependencies only to keep the image size small
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Cloud Run will set the PORT environment variable.
# Your application should listen on this port.
# The `node_proposal` app already listens on `process.env.PORT || 3000`, so this is good.
# EXPOSE is mainly for documenting which port the container listens on for local testing.
EXPOSE 8080

# Run the application
CMD ["npm", "start"]
