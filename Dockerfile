FROM node:20-alpine
WORKDIR /usr/src/app
# Install build dependencies for node-gyp/canvas
RUN apk add --no-cache python3 make g++ pkgconfig pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build --if-present
EXPOSE 3000
CMD ["npm", "run", "start:dev"] 