#!/bin/bash

# 设置错误处理
set -e

# 检查参数
if [ $# -gt 1 ]; then
    echo "Usage: $0 [version]"
    echo "Example: $0 1.0.0"
    exit 1
fi

VERSION=${1}
AGENT_IMAGE="iheytang/heyfun-agent:${VERSION}"
WEB_IMAGE="iheytang/heyfun-web:${VERSION}"
ALIYUN_REGISTRY="registry.cn-hangzhou.aliyuncs.com/iheytang"

# Print build information
echo "=============================================="
echo "Starting to build Docker images..."
echo "Agent service image: ${AGENT_IMAGE}"
echo "Web service image: ${WEB_IMAGE}"
echo "Version: ${VERSION}"
echo "=============================================="

# Build core service image
echo "=============================================="
echo "Building core service image..."
echo "Using Dockerfile: Dockerfile.run_api"
echo "=============================================="
docker build --progress=plain -t ${AGENT_IMAGE} -f Dockerfile.run_api .

# Build web service image
echo "=============================================="
echo "Building web service image..."
echo "Using Dockerfile: web/Dockerfile"
echo "=============================================="
docker build --progress=plain -t ${WEB_IMAGE} -f web/Dockerfile web/

# Check build result
if [ $? -eq 0 ]; then
    echo "=============================================="
    echo "Build successful!"
    echo "Agent service image: ${AGENT_IMAGE}"
    echo "Web service image: ${WEB_IMAGE}"
    echo "Version: ${VERSION}"
    echo "=============================================="

    # Tag and push to Aliyun registry
    echo "=============================================="
    echo "Tagging images for Aliyun registry..."
    echo "=============================================="
    docker tag ${AGENT_IMAGE} ${ALIYUN_REGISTRY}/heyfun-agent:${VERSION}
    docker tag ${WEB_IMAGE} ${ALIYUN_REGISTRY}/heyfun-web:${VERSION}

    echo "=============================================="
    echo "Images tagged successfully:"
    echo "${ALIYUN_REGISTRY}/heyfun-agent:${VERSION}"
    echo "${ALIYUN_REGISTRY}/heyfun-web:${VERSION}"
    echo "=============================================="
else
    echo "=============================================="
    echo "Build failed!"
    echo "=============================================="
    exit 1
fi
