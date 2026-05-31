import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useMatches, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useLayoutStore } from "../../stores/layout";
import { useAuthStore } from "../../stores/auth";
import { useBreadcrumbStore } from "../../stores/breadcrumb";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../../i18n";
import Button from "../common/Button/Button";
import Input from "../common/Input/Input";
import Breadcrumb, {
  type BreadcrumbItem,
  type BreadcrumbDropdownItem,
} from "../common/Breadcrumb/Breadcrumb";
import { SearchOption } from "./SearchOption";
import { ThemeSwitch } from "./ThemeSwitch";
import type { BreadcrumbDropdownItem as RouteBreadcrumbDropdownItem } from "../../lib/router/breadcrumb";
import "../../lib/router/breadcrumb";
import "./Header.css";

/**
 * 頂部標頭元件
 *
 * 實作滾動偵測：捲動超過 10px 時，高度由 80px 變為 60px。
 */
export const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toggleAi } = useLayoutStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setShowSettings(false);
    navigate({ to: "/login", replace: true });
  };
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const searchWrapper = document.getElementById("header-search-wrapper");
      const settingsWrapper = document.getElementById(
        "header-settings-wrapper",
      );
      if (searchWrapper && !searchWrapper.contains(e.target as Node)) {
        setShowSearch(false);
      }
      if (settingsWrapper && !settingsWrapper.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };

    // 用雙閾值避免邊界反覆觸發 (header 高度變化會影響 scrollTop，導致抖動)
    const SCROLL_ENTER = 16;
    const SCROLL_LEAVE = 4;
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        target.classList &&
        target.classList.contains("main-content")
      ) {
        const top = target.scrollTop;
        setIsScrolled((prev) =>
          prev ? top > SCROLL_LEAVE : top > SCROLL_ENTER,
        );
      }
    };

    window.addEventListener("scroll", handleScroll, true);
    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const handleFontSize = (delta: number) => {
    const newSize = Math.max(80, Math.min(120, fontSize + delta));
    setFontSize(newSize);
    document.documentElement.style.fontSize = `${newSize}%`;
  };

  const matches = useMatches();
  const pathname = useLocation({ select: (l) => l.pathname });
  const dynamicCurrentLabel = useBreadcrumbStore((s) => s.currentLabel);
  const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
    const mapDropdown = (
      items: RouteBreadcrumbDropdownItem[],
    ): BreadcrumbDropdownItem[] =>
      items.map((d) => ({
        label: d.labelKey ? t(d.labelKey) : (d.label ?? ""),
        to: d.to,
        href: d.href,
        active: d.activePaths
          ? d.activePaths.includes(pathname)
          : !!d.to && d.to === pathname,
        // 無 to / href / submenu 的項目（尚無路由）自動停用
        disabled: d.disabled ?? (!d.to && !d.href && !d.submenu),
        submenu: d.submenu ? mapDropdown(d.submenu) : undefined,
      }));

    for (let i = matches.length - 1; i >= 0; i--) {
      const bc = matches[i].staticData?.breadcrumb;
      if (bc && bc.length > 0) {
        return bc.map((item, idx) => {
          const isLast = idx === bc.length - 1;
          const baseLabel = item.labelKey ? t(item.labelKey) : (item.label ?? "");
          return {
            label: isLast && dynamicCurrentLabel ? dynamicCurrentLabel : baseLabel,
            to: item.to,
            current: isLast,
            dropdown: item.dropdown ? mapDropdown(item.dropdown) : undefined,
          };
        });
      }
    }
    return [];
  }, [matches, t, dynamicCurrentLabel, pathname]);

  const currentLang = (SUPPORTED_LANGUAGES as readonly string[]).includes(
    i18n.language,
  )
    ? (i18n.language as SupportedLanguage)
    : "zh-TW";

  const changeLanguage = (lng: SupportedLanguage) => {
    i18n.changeLanguage(lng);
  };

  return (
    <header className={`header-row ${isScrolled ? "scrolled" : ""}`}>
      <div className="header-content">
        <div className="header-left">
          {breadcrumbItems.length > 0 && (
            <Breadcrumb items={breadcrumbItems} ariaLabel={t("header.breadcrumb")} />
          )}
        </div>
        <div className="header-right">
          <div
            className={`search-wrapper ${showSearch ? "active" : ""}`}
            id="header-search-wrapper"
            onClick={(e) => {
              e.stopPropagation();
              setShowSearch(true);
            }}
          >
            <div className="search-main-row">
              <Input
                bare
                type="text"
                className="search-input"
                placeholder={t("header.searchPlaceholder")}
              />
              <Button
                variant="icon-ghost"
                id="search-toggle-btn"
                aria-label={t("header.searchBtn")}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSearch(!showSearch);
                }}
              >
                <i
                  className="fa-solid fa-magnifying-glass"
                  aria-hidden="true"
                ></i>
              </Button>
            </div>
            <div className="search-options">
              <SearchOption
                name="search-type"
                value="project"
                defaultChecked
                label={t("header.searchType.project")}
              />
              <SearchOption
                name="search-type"
                value="news"
                label={t("header.searchType.news")}
              />
              <SearchOption
                name="search-type"
                value="employee"
                label={t("header.searchType.employee")}
              />
            </div>
          </div>

          <Button variant="icon-ghost" aria-label={t("header.notification")}>
            <i className="fa-regular fa-bell" aria-hidden="true"></i>
          </Button>

          <div
            className={`settings-wrapper ${showSettings ? "active" : ""}`}
            id="header-settings-wrapper"
            onClick={(e) => {
              e.stopPropagation();
              setShowSettings(true);
            }}
          >
            <Button
              variant="icon-ghost"
              id="settings-toggle-btn"
              aria-label={t("header.settings")}
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(!showSettings);
              }}
            >
              <i className="fa-solid fa-gear" aria-hidden="true"></i>
            </Button>
            <div className="settings-dropdown">
              <div className="settings-section">
                <div className="section-label">{t("header.appearance")}</div>
                <ThemeSwitch />
              </div>
              <div className="settings-divider"></div>
              <div className="settings-section">
                <div className="section-label">{t("header.fontSize")}</div>
                <div className="font-size-control">
                  <button
                    className="font-btn"
                    id="font-decrease"
                    aria-label={t("header.fontDecrease")}
                    onClick={() => handleFontSize(-10)}
                    disabled={fontSize <= 80}
                  >
                    <i className="fa-solid fa-minus"></i>
                  </button>
                  <div className="font-value-display">
                    <span id="font-size-value">{fontSize}</span>%
                  </div>
                  <button
                    className="font-btn"
                    id="font-increase"
                    aria-label={t("header.fontIncrease")}
                    onClick={() => handleFontSize(10)}
                    disabled={fontSize >= 120}
                  >
                    <i className="fa-solid fa-plus"></i>
                  </button>
                </div>
              </div>
              <div className="settings-divider"></div>
              <div className="settings-section">
                <div className="section-label">
                  {t("header.switchLanguage")}
                </div>
                <div
                  className="language-switch-row"
                  role="group"
                  aria-label={t("header.switchLanguage")}
                >
                  {SUPPORTED_LANGUAGES.map((lng) => (
                    <button
                      key={lng}
                      type="button"
                      className={`language-btn ${currentLang === lng ? "active" : ""}`}
                      onClick={() => changeLanguage(lng)}
                      aria-pressed={currentLang === lng}
                    >
                      {t(`header.language.${lng}` as const)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-divider"></div>
              <button
                type="button"
                className="settings-login-btn"
                onClick={handleLogout}
              >
                <i className="fa-solid fa-right-from-bracket"></i>{" "}
                {t("header.logout")}
              </button>
            </div>
          </div>

          <Button
            variant="icon-ghost"
            id="right-sidebar-toggle-trigger"
            className="ai-highlight"
            aria-label={t("header.openRightSidebar")}
            onClick={(e) => {
              e.preventDefault();
              toggleAi();
            }}
          >
            <i className="fa-solid fa-robot" aria-hidden="true"></i>
            <span className="online-status"></span>
            <span className="ai-label-header">{t("header.aiAssistant")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
