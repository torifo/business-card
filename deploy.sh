#!/bin/bash
# VPS 上で実行するデプロイスクリプト。
# 指定バージョン (= image tag) を GHCR から pull して再起動する。
#
# Usage:
#   ./deploy.sh                  # latest を deploy
#   ./deploy.sh 20260522-1830    # 特定バージョンを deploy

set -e

VERSION="${1:-latest}"

echo "=== Business Card Deployment ==="
echo "Target version: ${VERSION}"
echo ""

echo "Step 1: Pulling container image"
IMAGE_TAG=${VERSION} docker compose pull
echo "OK: image pulled"
echo ""

echo "Step 2: Stopping current container"
docker compose down
echo "OK: container stopped"
echo ""

echo "Step 3: Starting new container with version ${VERSION}"
IMAGE_TAG=${VERSION} docker compose up -d
echo "OK: container started"
echo ""

echo "Step 4: Verifying deployment"
sleep 3
if docker compose ps | grep -q "business-card.*Up"; then
    echo "OK: deployment successful"
    echo ""
    docker compose ps
    echo ""
    echo "Recent logs:"
    docker compose logs --tail=20 business-card
else
    echo "ERROR: deployment failed. Logs:"
    docker compose logs business-card
    exit 1
fi

echo ""
echo "=== Deployment Complete ==="
echo "Website: https://business-card.riumu.net"
echo "Version: ${VERSION}"
echo ""
echo "Current image:"
docker inspect business-card --format='{{.Config.Image}}'
