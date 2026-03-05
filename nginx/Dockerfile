FROM nginx:1.25-alpine

RUN apk add --no-cache gettext nginx-module-njs

COPY js/no.js /etc/nginx/js/no.js
COPY no/reasons.json /etc/nginx/no/reasons.json
