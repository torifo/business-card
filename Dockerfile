# ビルド済み dist/ を nginx でサーブするだけの軽量イメージ。
# Astro 本体のビルドは CI 側 (GitHub Actions) で実行する。
# GITHUB_PAT を Docker build に渡す必要がないので、CI Secrets 経由の安全な構成。

FROM nginx:alpine

# 既存設定を上書き
COPY nginx.conf /etc/nginx/nginx.conf

# ビルド成果を配置
COPY dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
