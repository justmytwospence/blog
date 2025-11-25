---
title: "PyMC on remote GPU"
date: "2025-11-25"
categories: ["meta", "web-development", "portfolio", "next.js"]
description: "A complete setup for GPU-accelerated Bayesian modeling with PyMC on RunPod. Learn how to build a Docker container with CUDA and JAX, sync code with Mutagen, and cut sampling time by 10-100x using cloud GPUs for $0.40/hour."
featured: true
---

# PyMC on Remote GPU

If you've ever kicked off a PyMC model and watched the progress bar crawl through thousands of samples, you know the feeling. Hierarchical models with course effects, runner effects, and correlated parameters can take *hours* on a CPU. And if you're iterating on model structure? That's a lot of coffee.

The good news: PyMC's JAX backend combined with a cloud GPU can cut that time by 10-100x. The even better news: you don't need to own expensive hardware. Services like RunPod let you rent an RTX 4090 for about $0.40/hour—spin up a pod, run your sampling, pull the results, and shut it down.

This post walks through my complete setup for GPU-accelerated Bayesian modeling. 

## The Architecture

The workflow splits computation across two environments:

- **Local (MacBook)**: VS Code, notebooks, all my usual editing tools
- **Cloud (RunPod)**: Docker container with CUDA, JAX, PyMC, and a beefy GPU

[Mutagen](https://mutagen.io/) handles bidirectional file sync between them. I edit code locally, it syncs to the container in real-time, and when sampling finishes I pull the trained models back. Best of both worlds—comfortable local development with cloud GPU execution.

## The Dockerfile

Here's the complete Dockerfile that powers the setup:

```dockerfile
# Base image for PyMC GPU analysis - CUDA 12.4 (compatible with RunPod driver 565)
# Build: docker buildx build --platform linux/amd64 -t {docker-username}/pymc-base:v4 --push .

FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

# Environment setup for CUDA 12.4
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive \
    LD_LIBRARY_PATH=/usr/local/cuda-12.4/lib64:/usr/local/cuda-12.4/extras/CUPTI/lib64:${LD_LIBRARY_PATH}

# Install Python 3.12 from deadsnakes PPA + core system dependencies
RUN rm -rf /var/lib/apt/lists/* && \
    apt-get update && apt-get install -y software-properties-common && \
    add-apt-repository -y ppa:deadsnakes/ppa && \
    apt-get update && apt-get install -y \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    git \
    graphviz \
    libgraphviz-dev \
    curl \
    rsync \
    openssh-server \
    && rm -rf /var/lib/apt/lists/*

# Make Python 3.12 the default and install pip via ensurepip (avoids distutils issues)
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1 && \
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1 && \
    python -m ensurepip --upgrade && \
    python -m pip install --upgrade pip

# Configure SSH server (key-only authentication)
RUN mkdir /var/run/sshd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# Create SSH directory for authorized keys
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh

# Install JAX with CUDA 12 support
RUN pip install "jax[cuda12]>=0.4.30"

# Install PyMC stack with dependencies
RUN pip install \
    "pymc>=5.6.1" \
    "numpyro>=0.19.0" \
    "pymc-extras>=0.5.0" \
    "blackjax>=1.3" \
    "arviz>=0.22.0"

# Install base Python dependencies
RUN pip install \
    "duckdb>=1.0.0" \
    "pandas>=2.0.0" \
    "numpy>=1.24.0" \
    "matplotlib>=3.8.0" \
    "seaborn>=0.13.2" \
    "plotly>=5.18.0" \
    "igraph>=0.11.0" \
    "scipy>=1.11.0" \
    "graphviz>=0.20.3" \
    "ipywidgets>=8.1.7" \
    "jupyterlab>=4.0.0" \
    "ipykernel>=6.0.0" \
    "networkx>=3.0" \
    "qrcode[pil]>=8.2" \
    "requests>=2.31.0" \
    "tqdm>=4.66.0" \
    "rich" \
    "nvitop" \
    "psutil" \
    "gpustat"

# Register Python kernel for Jupyter 
RUN python -m ipykernel install --name=python3 --display-name="Python 3.12 (PyMC CUDA)"

# Create base working directories
RUN mkdir -p /workspace/analysis /workspace/data

# Install development tools (last layer - changes frequently)
RUN rm -rf /var/lib/apt/lists/* && apt-get update && apt-get install -y \
    tmux \
    htop \
    vim \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/analysis

# Copy and set up entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports (inherited by derived images)
EXPOSE 22 8888

ENTRYPOINT ["/entrypoint.sh"]
```

A few things worth noting:

- **NVIDIA CUDA 12.4 base image**: Includes cuDNN for accelerated operations. Make sure this matches your cloud provider's driver version.
- **Python 3.12 via deadsnakes**: Ubuntu 22.04 ships with Python 3.10, but modern PyMC benefits from 3.12's performance improvements.
- **JAX installed before PyMC**: Order matters here. JAX with CUDA support needs to be in place before PyMC pulls in its JAX dependencies.
- **SSH + JupyterLab**: The entrypoint starts both services, giving you flexibility—SSH in directly or access notebooks through the browser.

The entrypoint script starts the services and confirms GPU detection:

```bash
#!/bin/bash

# Start SSH daemon
echo "Starting SSH daemon..."
/usr/sbin/sshd || echo "Warning: sshd failed to start"

# Start JupyterLab in background (accessible on port 8888)
echo "Starting JupyterLab on port 8888..."
cd /workspace/analysis
jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root \
    --ServerApp.token='' --ServerApp.password='' &

# Check JAX GPU detection
echo "Checking JAX GPU detection..."
python -c "import jax; devices = jax.devices(); print(f'JAX detected {len(devices)} device(s): {devices}')"

echo "Services started. Container ready."

# Keep container alive
if [ $# -eq 0 ]; then
    exec tail -f /dev/null
else
    exec "$@"
fi
```

## The VS Code Workflow

VS Code tasks turn multi-step operations into single clicks. Here's my `tasks.json`:

```json
{
  "version": "2.0.0",
  "inputs": [
    {
      "id": "runpodHost",
      "type": "promptString",
      "description": "RunPod SSH host (e.g., 203.57.40.77)",
      "default": "203.57.40.77"
    },
    {
      "id": "runpodPort",
      "type": "promptString",
      "description": "RunPod SSH port",
      "default": "10225"
    }
  ],
  "tasks": [
    {
      "label": "RunPod: Push Data",
      "type": "shell",
      "command": "rsync -avz --progress ~/UltraSignup/analysis/data/ -e 'ssh -p ${input:runpodPort} -i ~/.ssh/id_ed25519' root@${input:runpodHost}:/workspace/analysis/data/",
      "group": "none"
    },
    {
      "label": "RunPod: Start Mutagen Sync",
      "type": "shell",
      "command": "mutagen sync terminate ultrasignup 2>/dev/null; mutagen sync create ~/UltraSignup/analysis root@${input:runpodHost}:${input:runpodPort}:/workspace/analysis --name=ultrasignup --ignore='.venv,__pycache__,*.pyc,.ipynb_checkpoints' && echo '✅ Mutagen sync started'",
      "group": "none"
    },
    {
      "label": "RunPod: Stop Mutagen Sync",
      "type": "shell",
      "command": "mutagen sync terminate ultrasignup && echo '✅ Mutagen sync stopped'",
      "group": "none"
    },
    {
      "label": "RunPod: Mutagen Status",
      "type": "shell",
      "command": "mutagen sync list",
      "group": "none"
    },
    {
      "label": "RunPod: Pull Models",
      "type": "shell",
      "command": "rsync -avz --progress -e 'ssh -p ${input:runpodPort} -i ~/.ssh/id_ed25519' root@${input:runpodHost}:/workspace/analysis/data/cache/ ~/UltraSignup/analysis/data/cache/",
      "group": "none"
    },
    {
      "label": "RunPod: Full Setup (Data + Sync)",
      "dependsOn": ["RunPod: Push Data", "RunPod: Start Mutagen Sync"],
      "dependsOrder": "sequence",
      "group": "none"
    },
    {
      "label": "RunPod: SSH Connect",
      "type": "shell",
      "command": "ssh -p ${input:runpodPort} -i ~/.ssh/id_ed25519 root@${input:runpodHost}",
      "group": "none",
      "presentation": {
        "focus": true
      }
    }
  ]
}
```

The key tasks:

- **Push Data**: One-time rsync of large data files (databases, datasets) to the container. These don't need continuous sync.
- **Start Mutagen Sync**: Bidirectional sync for code and notebooks. Edit locally, changes appear on the container instantly.
- **Pull Models**: After sampling completes, pull the trained model artifacts (NetCDF traces, pickled inference data) back to your local machine.
- **Full Setup**: Chains Push Data → Start Sync for one-click pod initialization.
- **SSH Connect**: Drop into the container for debugging or running commands directly.

The `inputs` section prompts for the RunPod host and port, which change each time you spin up a new pod. RunPod provides these in the pod details.

## Putting It Together

Here's the workflow in practice:

1. **Spin up a RunPod pod** using your custom template (pointing to your Docker image)
2. **Run "Full Setup"** task in VS Code—pushes data and starts file sync
3. **Edit notebooks locally**—Mutagen syncs changes to the container in real-time
4. **Execute cells**—sampling runs on the GPU, 10-100x faster than your laptop
5. **Run "Pull Models"** when done—brings trained artifacts back to local
6. **Terminate the pod**—stop paying for GPU time

A typical 2-hour modeling session costs about $0.80 on an RTX 4090. Compare that to waiting 20+ hours on a MacBook, and the economics are obvious.

## What's Next

I'm using this setup to build hierarchical Bayesian models for ultramarathon race analysis—estimating runner abilities, course difficulties, and DNF probabilities from historical race data. The models have thousands of parameters and would be impractical without GPU acceleration.

The full code is available at [github.com/justmytwospence/ultrasignup-analysis](https://github.com/justmytwospence/ultrasignup-analysis). Feel free to adapt it for your own projects, and reach out if you have questions!
