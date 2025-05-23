# Use Ubuntu 24.04 LTS with Miniconda
FROM continuumio/miniconda3:latest AS builder

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SETUSER=volweb \
    UID=10001 \
    DATABASE_PATH=file:/app/database/db.sqlite

# Add default value for DATABASE_URL
ARG DATABASE_URL="file:/app/database/db.sqlite"
ENV DATABASE_URL=$DATABASE_URL

# Create and setup user with proper home directory
RUN useradd -m -s /bin/bash -u ${UID} ${SETUSER} && \
    mkdir -p /home/${SETUSER}/.npm && \
    chown -R ${SETUSER}:${SETUSER} /home/${SETUSER}

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libtiff-dev \
    curl \
    wget \
    gnupg \
    git \
    build-essential \
    libpng-dev \
    libjpeg-dev \
    gfortran \
    liblapack-dev \
    libopenblas-dev \
    libxml2 \
    libglpk-dev \
    libxt-dev \
    libcairo2-dev \
    cmake && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Remove conflicting packages (npm and nodejs-legacy)
RUN apt-get purge -y npm nodejs-legacy || true && apt-get autoremove -y

# Install Node.js 20.x and npm using NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install CUDA 12.4 (For Proximal_CryoET)
RUN wget -q https://developer.download.nvidia.com/compute/cuda/12.4.0/local_installers/cuda_12.4.0_550.54.14_linux.run
RUN chmod +x cuda_12.4.0_550.54.14_linux.run && sh ./cuda_12.4.0_550.54.14_linux.run --silent --toolkit
ENV PATH="/usr/local/cuda/bin:${PATH}"
ENV LD_LIBRARY_PATH="/usr/local/cuda/lib64:${LD_LIBRARY_PATH}"

# Create app directory with proper permissions
WORKDIR /app
RUN chown ${SETUSER}:${SETUSER} /app && \
    mkdir -p /app/db && \
    chown -R ${SETUSER}:${SETUSER} /app/db

# Copy dependency files first for caching
COPY --chown=${SETUSER}:${SETUSER} ./requirements.txt /app/
COPY --chown=${SETUSER}:${SETUSER} ./package.json /app/

# Create conda environment and install Python dependencies
RUN conda create -n volweb python=3.8 -y && \
    . /opt/conda/etc/profile.d/conda.sh && \
    conda activate volweb && \
    pip install --no-cache-dir -r /app/requirements.txt && \
    conda clean -afy

# Install npm dependencies with updated Node.js version
USER ${SETUSER}
RUN npm install --cache /home/${SETUSER}/.npm && \
    npm cache clean --force

# Copy application files
USER root
COPY --chown=${SETUSER}:${SETUSER} ./ /app/

# Install IMOD
RUN chmod +x /app/install_imod.sh && \
    /app/install_imod.sh && \
    chmod +x /app/modules/imod/IMOD/IMOD-linux.sh && \
    /app/modules/imod/IMOD/IMOD-linux.sh

# Follow README instructions
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

RUN chmod +x /app/build_submodules.sh && /app/build_submodules.sh
RUN mkdir /app/database

USER ${SETUSER}
RUN chmod +x /app/build_client.sh && \
    . /opt/conda/etc/profile.d/conda.sh && \
    conda activate volweb && \
    /app/build_client.sh

# Set up directories and permissions
USER root
RUN chmod -R 770 /app/database /app/modules

# Expose port
EXPOSE 8080
