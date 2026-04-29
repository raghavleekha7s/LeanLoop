# Build stage — compiles each LeanLoop custom node package to dist/
FROM node:20-alpine AS builder
WORKDIR /build

# Copy sources for all four node packages and install + build each.
COPY custom-nodes /build/custom-nodes

RUN set -eu; \
    cd /build/custom-nodes; \
    for pkg in razorpay tally shiprocket gst-invoice; do \
      if [ -f "$pkg/package.json" ]; then \
        echo "── Building $pkg ──"; \
        cd "$pkg"; \
        npm install --no-audit --no-fund; \
        npm run build; \
        cd ..; \
      fi; \
    done

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM n8nio/n8n:latest
USER root

# n8n auto-loads community nodes from ~/.n8n/custom — copy the compiled dist
# plus each package's package.json (n8n reads the "n8n" field to discover
# nodes + credentials).
RUN mkdir -p /home/node/.n8n/custom

COPY --from=builder --chown=node:node /build/custom-nodes /home/node/.n8n/custom

USER node
