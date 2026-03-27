FROM node:22-alpine AS codex-install
RUN npm install -g @openai/codex@latest

FROM node:22-alpine
RUN apk add --no-cache ca-certificates git
COPY --from=codex-install /usr/local/lib/node_modules/@openai/codex /usr/local/lib/node_modules/@openai/codex
RUN echo '#!/bin/sh' > /usr/local/bin/codex && \
    echo 'exec node /usr/local/lib/node_modules/@openai/codex/bin/codex.js "$@"' >> /usr/local/bin/codex && \
    chmod +x /usr/local/bin/codex
COPY claudectl-linux /usr/local/bin/c9s
ENTRYPOINT ["c9s"]
