import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLayoutStore } from "../../stores/layout";
import "./RightSidebar.css";

/**
 * 右側 AI 助理側邊欄元件
 * 
 * 使用 exact HTML DOM 結構以達成 Visual Parity。
 */
export const RightSidebar: React.FC = () => {
  const { t } = useTranslation();
  const { isAiOpen, closeAi } = useLayoutStore();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "user",
      content: " 請問目前我的年度特休還有幾天？ ",
      time: "2025-11-27 17:38:03",
    },
    {
      id: 2,
      type: "ai",
      content:
        " 您好！根據系統查詢，您 2025 年度的特休資訊如下： <br><br> • 總額度：15 天<br> • 已使用：5 天<br> • 剩餘：10 天<br><br> 提醒您，下週五 (12/05) 您已預先申請一天特休。如需操作請至<a href=\"#\">「特休請假」</a>流程查看。 ",
      time: "2025-11-27 17:38:29",
    },
    {
      id: 3,
      type: "user",
      content: " 幫我查詢會議室 R402 明天下午還有空位嗎？ ",
      time: "2025-11-27 17:40:15",
    },
    {
      id: 4,
      type: "ai",
      content: " 正在查詢會議室 R402 11/28 (五) 的預約狀況... <br><br> 明天下午該會議室目前的空檔為：<br> • 14:00 - 15:30 (空閒)<br> • 17:00 之後 (空閒) <br><br> 15:30 - 17:00 已被行政處預約進行部門週會。需要我幫您開啟<a href=\"#\">預約介面</a>嗎？ ",
      time: "2025-11-27 17:41:02",
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAiOpen) {
      // 延遲捲動以配合側邊欄滑入動畫
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isAiOpen, messages]);

  return (
    <aside className={`right-sidebar ${isAiOpen ? 'active' : ''}`}>
      <div className="chat-container">
        <div className="chat-header">
          <div className="header-main">
            <div className="chat-title">
              <span className="title-primary">{t("rightSidebar.title")}</span>
              <span className="title-secondary">| {t("rightSidebar.subtitle")}</span>
            </div>
            <div className="header-actions">
              <button className="chat-action-btn" aria-label={t("rightSidebar.refresh")} onClick={() => setMessages([])}>
                <i className="fa-solid fa-rotate"></i>
              </button>
              <button id="close-right-sidebar" className="chat-action-btn" aria-label={t("rightSidebar.close")} onClick={closeAi}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          <div className="chat-status">
            <span className="status-dot"></span> {t("rightSidebar.online")}
          </div>
        </div>
        <div className="chat-messages">
          <div className="timestamp">2025-11-27 17:37:21</div>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.type === "user" ? "user-message" : "ai-message"}`}
            >
              <div className="message-meta">
                {msg.type === "user" ? (
                  <>{t("rightSidebar.you")} <i className="fa-solid fa-circle-user"></i></>
                ) : (
                  <>{t("rightSidebar.subtitle")}</>
                )}
              </div>
              <div
                className="message-bubble"
                dangerouslySetInnerHTML={{ __html: msg.content }}
              ></div>
              <div className="message-time">{msg.time}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-area">
          <div className="input-wrapper">
            <textarea id="chat-input" placeholder={t("rightSidebar.inputPlaceholder")} rows={1} onFocus={(e) => {
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = e.currentTarget.scrollHeight + "px";
                }}></textarea>
            <button className="send-btn" aria-label={t("rightSidebar.send")}>
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
