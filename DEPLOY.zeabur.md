# 部署到 Zeabur（方案 B：前後端分開兩個服務）

本專案是 npm workspaces monorepo。採「前後端各自一個 Zeabur 服務、共用同一個 GitHub repo」的部署方式，
透過根目錄的兩個 Dockerfile 建置：

- `Dockerfile.server` → **server 服務**（Express API）
- `Dockerfile.client` → **client 服務**（Vite 靜態網站，nginx 提供）

> 目前 MVP 的 server runtime 只用到 Anthropic SDK / Express 那批套件，**還沒接 Postgres / Redis**，
> 所以這版不需要建立資料庫服務。等程式碼真的接 DB / 佇列時，再到同一個 Project 一鍵加 PostgreSQL / Redis。

---

## 一、自動部署（push 到 repo 就重新部署）

Zeabur 連上 GitHub repo 後，會 watch 指定分支；**每次 `git push` 到該分支就自動 build + redeploy**，
這就是「上傳到 repo 自動部署」。下面建好兩個服務後就自動生效，不需額外設定。

---

## 二、建立步驟

1. 登入 https://zeabur.com → **Create Project**（建議選離你近的 region，如 AWS Tokyo）。
2. 連接 GitHub，授權存取 `KevinYang2229/oa-agent`。

### 服務 A：server
3. **Add Service → Git → 選 oa-agent repo**。
4. 進該服務 → **Settings / Variables**，新增一個建置變數指定要用的 Dockerfile：
   - `ZBPACK_DOCKERFILE_NAME = Dockerfile.server`
5. 設定下方「server 環境變數」（見第三節）。
6. **Networking → 產生 Domain**（例：`oa-agent-server.zeabur.app`）。記下這個網址，client 要用。

### 服務 B：client
7. 在同一個 Project 再 **Add Service → Git → 選同一個 oa-agent repo**。
8. 該服務 **Variables** 新增：
   - `ZBPACK_DOCKERFILE_NAME = Dockerfile.client`
   - `VITE_API_BASE = https://oa-agent-server.zeabur.app`  ← 填服務 A 的 Domain
     （Vite 會在 **build 階段** 把這個值 bake 進前端 bundle；改了要重新 build 才生效）
9. **Networking → 產生 Domain**（例：`oa-agent.zeabur.app`）。記下來，回填到 server 的 `CORS_ORIGIN`。

> 兩個服務都用 repo 根目錄當 build context，`ZBPACK_DOCKERFILE_NAME` 決定各自用哪個 Dockerfile。

---

## 三、環境變數

### server 服務
| 變數 | 必填 | 範例 / 說明 |
|------|------|------|
| `NODE_ENV` | 建議 | `production` |
| `ANTHROPIC_API_KEY` | ✅ 必填 | 沒填 server 啟動會直接 fail-fast 退出 |
| `JWT_ACCESS_SECRET` | ✅ | ≥32 字元隨機字串 |
| `JWT_REFRESH_SECRET` | ✅ | ≥32 字元隨機字串（與上者不同） |
| `CORS_ORIGIN` | 建議 | 填 client 的 Domain，如 `https://oa-agent.zeabur.app`（預設 `*` 也能動，但建議收斂） |
| `AUTH_DEV_PASSWORD` | 視需要 | MVP 登入共用密碼，預設 `oa1234`，正式環境請改 |
| `LLM_MODEL` | 選填 | 預設 `claude-sonnet-4-5` |
| `PORT` | 不用填 | Zeabur 自動注入，server 會自動聽 |

> 產生隨機 secret 可用：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### client 服務
| 變數 | 必填 | 說明 |
|------|------|------|
| `ZBPACK_DOCKERFILE_NAME` | ✅ | `Dockerfile.client` |
| `VITE_API_BASE` | ✅ | server 的對外網址，build 時 bake 進 bundle |

---

## 四、驗證
- 開 client Domain → 應正常載入頁面。
- 用帳號 + `AUTH_DEV_PASSWORD` 登入 → 對話功能能打到 server（瀏覽器 Network 面板看到請求送往 `VITE_API_BASE`，回 200）。
- 若出現 CORS 錯誤 → 確認 server 的 `CORS_ORIGIN` 等於 client 的 Domain（含 `https://`、結尾不要多斜線）。

## 五、本機驗證（可選，需裝 Docker）
```bash
# server
docker build -f Dockerfile.server -t oa-server .
docker run --rm -p 3000:3000 -e ANTHROPIC_API_KEY=sk-xxx \
  -e JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
  -e JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
  oa-server

# client（把 VITE_API_BASE 指向上面的 server）
docker build -f Dockerfile.client --build-arg VITE_API_BASE=http://localhost:3000 -t oa-client .
docker run --rm -p 8080:8080 oa-client   # 開 http://localhost:8080
```
