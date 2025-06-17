#!/bin/bash

set -e

if [ $# -gt 1 ]; then
    echo "Usage: $0 [version]"
    echo "Example: $0 1.0.0"
    exit 1
fi

VERSION=${1}
AGENT_IMAGE="iheytang/heyfun-agent:${VERSION}"
WEB_IMAGE="iheytang/heyfun-web:${VERSION}"
ALIYUN_REGISTRY="registry.cn-hangzhou.aliyuncs.com/iheytang"

# Print push information
echo "=============================================="
echo "Starting to push Docker images..."
echo "Agent service image: ${AGENT_IMAGE}"
echo "Web service image: ${WEB_IMAGE}"
echo "Version: ${VERSION}"
echo "=============================================="

# Push to Docker Hub
echo "=============================================="
echo "Pushing to Docker Hub..."
echo "=============================================="
docker push ${AGENT_IMAGE}
docker push ${WEB_IMAGE}

# Push to Aliyun registry
echo "=============================================="
echo "Pushing to Aliyun registry..."
echo "=============================================="
docker push ${ALIYUN_REGISTRY}/heyfun-agent:${VERSION}
docker push ${ALIYUN_REGISTRY}/heyfun-web:${VERSION}

# Check push result
if [ $? -eq 0 ]; then
    echo "=============================================="
    echo "Push successful!"
    echo "Docker Hub images:"
    echo "- ${AGENT_IMAGE}"
    echo "- ${WEB_IMAGE}"
    echo "Aliyun registry images:"
    echo "- ${ALIYUN_REGISTRY}/heyfun-agent:${VERSION}"
    echo "- ${ALIYUN_REGISTRY}/heyfun-web:${VERSION}"
    echo "Version: ${VERSION}"
    echo "=============================================="
else
    echo "=============================================="
    echo "Push failed!"
    echo "=============================================="
    exit 1
fi
