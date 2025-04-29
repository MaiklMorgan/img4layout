FROM node:18-slim

WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Create required directories
RUN mkdir -p /tmp/uploads

# Expose port
EXPOSE 3000

# Start the application
CMD [ "node", "server.js" ] 