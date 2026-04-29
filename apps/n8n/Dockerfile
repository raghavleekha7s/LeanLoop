# Build stage — compiles each LeanLoop custom node package to dist/
# We use --ignore-scripts because n8n-workflow's transitive dep `isolated-vm`
# tries to compile native code (needs Python + build tools). Our custom nodes
# only need n8n-workflow's TypeScript declarations, not its runtime, so we
# skip postinstall scripts entirely. n8n provides the runtime at execution
# time inside the n8n image.
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
        npm install --no-audit --no-fund --ignore-scripts; \
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
