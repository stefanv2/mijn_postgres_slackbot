# Gebruik Node.js als basis
FROM node:20

# App directory
WORKDIR /app

# Kopieer package.json en package-lock.json
COPY package*.json ./

# Installeer dependencies
RUN npm install

# Kopieer de rest van de code
COPY . .

# Expose de interne poort (3003 zoals in index.js)
EXPOSE 3003

# Start de app
CMD ["node", "index.js"]

