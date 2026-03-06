#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NAMESPACE="grafana"
RELEASE="grafana"

echo "==> Adding Grafana Helm repo..."
helm repo add grafana https://grafana.github.io/helm-charts 2>/dev/null || true
helm repo update grafana

echo "==> Creating namespace '$NAMESPACE'..."
kubectl create namespace "$NAMESPACE" 2>/dev/null || true

echo "==> Creating dashboards ConfigMap..."
kubectl create configmap grafana-dashboards \
  --from-file="$SCRIPT_DIR/dashboards/" \
  -n "$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -

SCENES_DIR="$SCRIPT_DIR/../grafana-scenes-app/dist"
if [ -d "$SCENES_DIR" ]; then
  echo "==> Creating Scenes plugin ConfigMap..."
  # Delete first to avoid annotation size limit (bundled module.js > 256KB)
  kubectl delete configmap grafana-scenes-plugin -n "$NAMESPACE" 2>/dev/null || true
  kubectl create configmap grafana-scenes-plugin \
    --from-file=module.js="$SCENES_DIR/module.js" \
    --from-file=plugin.json="$SCENES_DIR/plugin.json" \
    --from-file=logo.svg="$SCENES_DIR/img/logo.svg" \
    -n "$NAMESPACE"
else
  echo "    WARNING: Scenes plugin not built. Run 'cd grafana-scenes-app && npm run build' first."
fi

echo "==> Creating plugin provisioning ConfigMap..."
kubectl create configmap grafana-plugin-provisioning \
  --from-file="$SCRIPT_DIR/../grafana-scenes-app/provisioning/plugins/app.yaml" \
  -n "$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Installing/upgrading Grafana..."
helm upgrade --install "$RELEASE" grafana/grafana \
  -n "$NAMESPACE" \
  -f "$SCRIPT_DIR/values.yaml" \
  --wait --timeout 5m

echo "==> Ensuring grafana.localhost is in /etc/hosts..."
if ! grep -q 'grafana.localhost' /etc/hosts; then
  echo "127.0.0.1 grafana.localhost" | sudo tee -a /etc/hosts
  echo "    Added grafana.localhost to /etc/hosts"
else
  echo "    Already present in /etc/hosts"
fi

echo "==> Waiting for Grafana pod to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana \
  -n "$NAMESPACE" --timeout=180s

echo ""
echo "==> Grafana deployed successfully!"
echo "    URL:      http://grafana.localhost"
echo "    Login:    admin / admin"
echo ""
echo "    Dashboards:"
echo "      - Agent Activity:  http://grafana.localhost/d/cm-agent-activity"
echo "      - Cost & Usage:    http://grafana.localhost/d/cm-cost-usage"
echo "      - System Health:   http://grafana.localhost/d/cm-system-health"
