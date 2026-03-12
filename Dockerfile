FROM node:22-alpine AS claude-install
RUN npm install -g @anthropic-ai/claude-code@latest

FROM node:22-alpine
RUN apk add --no-cache ca-certificates git
COPY --from=claude-install /usr/local/lib/node_modules/@anthropic-ai/claude-code /usr/local/lib/node_modules/@anthropic-ai/claude-code
RUN echo '#!/bin/sh' > /usr/local/bin/claude && \
    echo 'exec node /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js "$@"' >> /usr/local/bin/claude && \
    chmod +x /usr/local/bin/claude
COPY claudectl-linux /usr/local/bin/claudectl
ENTRYPOINT ["claudectl"]
