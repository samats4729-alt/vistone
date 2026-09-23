FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN mkdir -p /app/data

# Постоянный диск подключается к /app/data средствами хостинга:
# на Railway — Volume с путём /app/data, в docker-compose — том vistone_data.
EXPOSE 3000
CMD ["node", "server.js"]
