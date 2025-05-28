# syntax=docker/dockerfile:1.7-labs

# Use NVIDIA CUDA base image with Ubuntu 24.04 and Miniconda pre-installed
FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

# Set environment variables early for caching
ENV DEBIAN_FRONTEND=noninteractive \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SETUSER=volweb \
    UID=10001 \
    PATH=/opt/conda/bin:$PATH

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
        cmake \
        curl \
        wget \
        gnupg \
        git \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Miniconda (latest Miniconda3 installer)
RUN wget --quiet https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh \
    && bash /tmp/miniconda.sh -b -p /opt/conda \
    && rm /tmp/miniconda.sh \
    && /opt/conda/bin/conda clean -afy

# Create user with specified UID and home directory
RUN useradd -m -s /bin/bash -u ${UID} ${SETUSER} \
    && mkdir -p /home/${SETUSER}/.npm \
    && chown -R ${SETUSER}:${SETUSER} /home/${SETUSER}
    
# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory and permissions
WORKDIR /app
RUN chown ${SETUSER}:${SETUSER} /app

# Copy dependency files first for better layer caching
COPY --chown=${SETUSER}:${SETUSER} requirements.txt package.json /app/

# Create conda environment and install Python dependencies
RUN /opt/conda/bin/conda create -n volweb python=3.9 -y \
    && /bin/bash -c "source /opt/conda/etc/profile.d/conda.sh && conda activate volweb && pip install --no-cache-dir -r /app/requirements.txt" \
    && /opt/conda/bin/conda clean -afy

# Install npm dependencies with cache
USER ${SETUSER}
RUN npm install --cache /home/${SETUSER}/.npm

# Copy application source code
USER root

COPY --chown=${SETUSER}:${SETUSER} scripts /app/scripts
COPY --chown=${SETUSER}:${SETUSER} modules /app/modules

# Set executable permissions for scripts
RUN find /app/scripts -type f -name "*.sh" -exec chmod +x {} +

# Install submodules and build the client
USER ${SETUSER}

RUN /app/scripts/install_submodules.sh

COPY --exclude=scripts --exclude=modules --chown=${SETUSER}:${SETUSER} ./ /app/

RUN /app/scripts/build_client.sh

# Set permissions on important directories
USER root
RUN chmod -R 775 /app/modules

# Expose application port
EXPOSE 8080

# Default user
USER ${SETUSER}
