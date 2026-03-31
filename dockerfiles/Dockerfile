# syntax=docker/dockerfile:1.7-labs

# Use NVIDIA CUDA base image with Ubuntu 24.04 and Miniconda pre-installed
FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

# Build argument for CUDA architectures (e.g. "native" if it works, "80;86;90" for multiple, or "80" for single)
ARG CUDA_ARCHITECTURES=native

# Set environment variables early for caching
ENV DEBIAN_FRONTEND=noninteractive \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SETUSER=volweb \
    UID=10001 \
    PATH=/opt/conda/bin:$PATH \
    CUDA_HOME=/usr/local/cuda

# Install system dependencies, Miniconda, Node.js 20.x
RUN apt-get update && apt-get install -y --no-install-recommends \
    libtiff-dev \
    libpng-dev \
    libjpeg-dev \
    gfortran \
    liblapack-dev \
    libopenblas-dev \
    nvidia-container-toolkit \
    libxml2 \
    libglpk-dev \
    libxt-dev \
    libcairo2-dev \
    curl \
    wget \
    gnupg \
    git \
    build-essential \
    file \
    && rm -rf /var/lib/apt/lists/*

# Install CMake 3.24+ from official release (not from apt which has older version)
RUN wget https://github.com/Kitware/CMake/releases/download/v3.27.8/cmake-3.27.8-linux-x86_64.tar.gz -O /tmp/cmake.tar.gz \
    && tar -xzf /tmp/cmake.tar.gz -C /usr/local --strip-components=1 \
    && rm /tmp/cmake.tar.gz

# Install Miniconda (latest Miniconda3 installer)
RUN wget --quiet https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh \
    && bash /tmp/miniconda.sh -b -p /opt/conda \
    && rm /tmp/miniconda.sh \
    && /opt/conda/bin/conda clean -afy

# Create user with specified UID and home directory
RUN useradd -m -s /bin/bash -u ${UID} ${SETUSER} \
    && mkdir -p /home/${SETUSER}/.npm \
    && chown -R ${SETUSER}:${SETUSER} /home/${SETUSER}

# Install Node.js 24.x
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory and permissions
WORKDIR /app
RUN chown ${SETUSER}:${SETUSER} /app

# Copy python dependency files first so we can fail faster
COPY --chown=${SETUSER}:${SETUSER} server/requirements.txt /app/server/

# Create conda environment and install Python dependencies
RUN /opt/conda/bin/conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main \
    && /opt/conda/bin/conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r \
    && /opt/conda/bin/conda create -n volweb python=3.9 -y \
    && /opt/conda/bin/conda run -n volweb pip install --no-cache-dir -r /app/server/requirements.txt \
    && /opt/conda/bin/conda clean -afy

# Copy application source code
USER root
COPY --chown=${SETUSER}:${SETUSER} ./ /app/

USER ${SETUSER}

# Install npm dependencies with cache and build shared schema package
RUN cd /app/schemas && npm install && npm run build
RUN cd /app/server && npm install

# Install/download external modules through Node-based installer
RUN --mount=type=cache,id=volweb-module-cache,target=/app/server/.module-cache,uid=10001,gid=10001 \
    cd /app/server && npm run modules:install

# Build client bundle
RUN cd /app/client && npm install && npm run build

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN cd /app/server && npx prisma generate && npm run build

# Expose application port
USER root
EXPOSE 8080

# Default user
USER ${SETUSER}