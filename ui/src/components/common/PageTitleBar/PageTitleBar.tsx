import { useMatches } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { useBreadcrumbStore } from "../../../stores/breadcrumb";
import { useNavigateToParent } from "../../../lib/router/parentPath";
import "../../../lib/router/breadcrumb";

interface PageTitleBarProps {
  /** 頁面標題；未提供時自動取用當前麵包屑的最後一段 */
  title?: ReactNode;
}

/**
 * 取得當前頁麵包屑最後一段作為頁面標題。
 * 與 Header 麵包屑共用同一份 staticData 與動態覆蓋值。
 */
function useCurrentPageTitle(): string {
  const matches = useMatches();
  const dynamicLabel = useBreadcrumbStore((s) => s.currentLabel);
  const { t } = useTranslation();

  for (let i = matches.length - 1; i >= 0; i--) {
    const bc = matches[i].staticData?.breadcrumb;
    if (bc && bc.length > 0) {
      const last = bc[bc.length - 1];
      const base = last.labelKey ? t(last.labelKey) : (last.label ?? "");
      return dynamicLabel || base;
    }
  }
  return "";
}

/**
 * 內頁最上方標題列：返回上一頁箭頭 + 頁面標題。
 *
 * 返回箭頭一律回到當前路徑的上一層（`useNavigateToParent`）。
 * 套用於除「表單填寫頁」外的所有內頁，提供一致的標題與返回入口。
 */
export function PageTitleBar({ title }: PageTitleBarProps) {
  const goToParent = useNavigateToParent();
  const { t } = useTranslation();
  const fallbackTitle = useCurrentPageTitle();

  return (
    <div className="flex w-full items-center gap-2">
      <button
        type="button"
        aria-label={t("common.back")}
        onClick={goToParent}
        className="inline-flex cursor-pointer items-center border-0 bg-transparent p-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <i className="fa-solid fa-chevron-left" />
      </button>
      <h1 className="m-0 text-[1.25rem] font-bold text-[var(--text-primary)]">
        {title ?? fallbackTitle}
      </h1>
    </div>
  );
}

export default PageTitleBar;
