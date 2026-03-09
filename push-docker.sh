#!/bin/bash
# Docker 镜像构建推送脚本

IMAGE_NAME="yfmeii/media-scraper-web"
TAG="${1:-latest}"

echo "🔨 正在构建镜像: ${IMAGE_NAME}:${TAG}"

# 登录 DockerHub
echo "🔑 登录 DockerHub..."
echo "$DOCKER_TOKEN" | docker login -u yfmeii --password-stdin

# 构建并推送
docker build -t ${IMAGE_NAME}:${TAG} .
docker tag ${IMAGE_NAME}:${TAG} ${IMAGE_NAME}:latest
docker push ${IMAGE_NAME}:${TAG}
docker push ${IMAGE_NAME}:latest

echo "✅ 完成！镜像已推送至 https://hub.docker.com/r/${IMAGE_NAME}"
