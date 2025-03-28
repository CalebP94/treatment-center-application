# Stage 1: Build React App
FROM node:18 AS build

#build work dir in the container
WORKDIR /app/find-near-rehab-center


COPY find-near-rehab-center/package*.json ./
RUN npm install
COPY find-near-rehab-center/. ./
RUN npm run build

# Stage 2: Serve with NGINX
FROM nginx:alpine

# Copy built app to NGINX default directory
COPY --from=build /app/find-near-rehab-center/build /usr/share/nginx/html

# Optional: Overwrite default nginx config if needed
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
