FROM node:18-alpine

# System deps for mediasoup
RUN apk add --no-cache bash python3 make g++ libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
