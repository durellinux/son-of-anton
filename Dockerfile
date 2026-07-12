# Use a Node.js base image
FROM node:20-slim

# Install system dependencies including curl and gnupg for gh cli
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    software-properties-common \
    git \
    apt-transport-https \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install gh -y \
    && rm -rf /var/lib/apt/lists/*

# Configure git system-wide for the sandbox
RUN git config --system credential.helper '!gh auth git-credential' \
    && git config --system safe.directory '*' \
    && git config --system user.name "Son of Anton" \
    && git config --system user.email "anton@sonofanton.local"

# Default directory
WORKDIR /workspace

USER node

# Install Gemini CLI globally
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash

