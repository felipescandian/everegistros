FROM node:20-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice \
      fonts-liberation \
      fonts-dejavu-core \
      fonts-noto-core \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./

ENV PORT=3000
EXPOSE 3000
CMD ["npm","start"]
