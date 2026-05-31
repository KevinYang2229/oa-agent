import type { ReactNode } from "react";

interface FieldHintProps {
  /** 提示文字內容 */
  children: ReactNode;
  /**
   * 渲染標籤，預設 `div`。
   * 需緊接在 inline 元素（如 `<Select>`）之後時可用 `span`，會自動補上 `block`。
   */
  as?: "div" | "span";
  /**
   * 間距／版面 className，預設 `mt-2`。
   * 傳入時會「取代」預設值（而非疊加），以避免 `mt-2`、`mt-1.5` 等
   * Tailwind 互斥 class 同時出現；例如需較小間距可傳 `mt-1.5`。
   */
  className?: string;
}

/**
 * 欄位下方的紅色格式／注意提示文字
 * 統一各流程表單重複的 `text-[0.8125rem] text-[var(--status-danger)]` 樣板，
 * 例如「正確格式：(如：00-90-F5-DE-DA-6D)」這類欄位說明。
 */
export function FieldHint({
  children,
  as: Tag = "div",
  className = "mt-2",
}: FieldHintProps) {
  const cls = [
    className,
    Tag === "span" ? "block" : "",
    "text-[0.8125rem] text-[var(--status-danger)]",
  ]
    .filter(Boolean)
    .join(" ");

  return <Tag className={cls}>{children}</Tag>;
}
