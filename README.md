# 🕵️ Who's the Undercover?（誰是臥底）

給 Zoom 線上團隊活動用的多人猜詞遊戲。4 到 12 人，每人用自己的手機或筆電加入；主持人在 Zoom 分享 Host 畫面。遊戲介面是英文。

- 技術：React + Vite + Tailwind（`client/`），Node.js + Express + Socket.IO（`server/`）
- 部署：一個 Render 免費 Web Service，一個網址（`https://xxx.onrender.com`）
- 資料只存在記憶體，不需要資料庫。房間閒置超過 2 小時會自動清除。

## 在自己電腦上執行

需要 Node.js 20 以上（建議安裝 LTS 版）。

```bash
npm install        # 第一次執行，會同時安裝 server 和 client 的套件
npm run dev        # 開發模式，打開 http://localhost:5173
```

正式版測試（和 Render 上的跑法一樣）：

```bash
npm run build      # 打包前端到 client/dist
npm start          # 打開 http://localhost:3001
```

自動測試：`npm test`（模擬完整一局遊戲、斷線重連、隱私檢查等）。

## 如何更新詞組

**方法一（最簡單，不用改程式）：** 活動當天在 `/setup` 頁面直接新增、修改、刪除、排序詞組，也可以每組開關「Mr. White（白板）」。設定會存在主持人的瀏覽器裡，下次打開還在。

**方法二（改預設詞組）：** 編輯 `client/src/lib/wordPairs.js`，每一組格式是 `['臥底的詞 Word A', '平民的詞 Word B']`。改完後照下面「重新部署」的步驟推上 GitHub。

## 如何重新部署

Render 會在 GitHub 有新的 commit 時自動重新部署：

1. 在 GitHub 網頁上打開 `whos-the-undercover` repo，找到要改的檔案，按鉛筆圖示編輯，按 **Commit changes**。（或用 git：`git add . && git commit -m "更新詞組" && git push`）
2. 到 Render 的 Dashboard，等狀態變成 **Live**（大約 2–4 分鐘）。

## ⚠️ 免費方案的注意事項

- Render 免費方案在 **15 分鐘沒人使用後會進入睡眠**，下一次打開需要等約 1 分鐘才會醒來。
- **活動開始前約 5 分鐘，先打開網址把它叫醒**，再建立房間。
- 服務重新啟動（睡眠後醒來、重新部署）時，**所有房間都會消失**，需要重新建立房間，玩家用新的房號加入。活動進行中請不要重新部署。

## 遊戲規則摘要

- 平民（多數）拿到相同的詞；臥底拿到相近但不同的詞（4–7 人 1 位，8 人以上 2 位）。
- 白板（Mr. White）沒有詞，只有 5 人以上、且該詞組有開啟時才會出現；白板不會第一個發言。
- 流程：輪流給線索 → 討論 → 投票 → 揭曉 → 淘汰，主持人用按鈕控制每一步。
- 平局時主持人可選「在平手玩家間重投」或「本輪不淘汰」。
- 白板被淘汰時可以猜一次平民的詞（不分大小寫），猜中白板獲勝。
- 平民勝：臥底和白板都被淘汰。臥底方勝：臥底＋白板人數 ≥ 平民人數（例如剩最後 2 人時臥底還在）。白板撐到最後也算和臥底一起獲勝。

## 專案結構

```
client/            React 前端（頁面在 client/src/pages）
server/            Express + Socket.IO 後端（遊戲邏輯在 server/game.js）
server/test/       自動測試
render.yaml        Render Blueprint 設定
package.json       根目錄指令（dev / build / start / test）
```
