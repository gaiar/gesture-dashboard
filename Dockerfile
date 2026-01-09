# NEXUS Gesture Dashboard - Docker Image
# Serves the static web application using nginx

FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy application files
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Labels for GitHub Container Registry
LABEL org.opencontainers.image.source="https://github.com/gaiar/gesture-dashboard"
LABEL org.opencontainers.image.description="NEXUS - Sci-Fi Hand Gesture Control Interface"
LABEL org.opencontainers.image.licenses="MIT"
