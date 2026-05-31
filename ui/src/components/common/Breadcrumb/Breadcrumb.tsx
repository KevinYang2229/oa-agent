import { Link, type LinkProps } from "@tanstack/react-router";
import { type ReactNode } from "react";
import Dropdown from "../Dropdown/Dropdown";

export interface BreadcrumbDropdownItem {
  label: ReactNode;
  to?: LinkProps["to"];
  /** 外部連結（非 SPA 路由） */
  href?: string;
  /** 是否為目前所在頁；於下拉清單中標示 active 狀態 */
  active?: boolean;
  /** 是否停用（無對應路由的項目） */
  disabled?: boolean;
  /** 巢狀子選單；提供時此項目成為子選單觸發器，hover / focus 時展開 */
  submenu?: BreadcrumbDropdownItem[];
}

/** 遞迴渲染下拉項目，支援巢狀子選單 */
function renderDropdownItems(items: BreadcrumbDropdownItem[]): ReactNode {
  return items.map((d, idx) => (
    <Dropdown.Item
      key={`dropdown-${idx}`}
      to={d.to}
      href={d.href}
      active={d.active}
      disabled={d.disabled}
      submenu={
        d.submenu && d.submenu.length > 0
          ? renderDropdownItems(d.submenu)
          : undefined
      }
    >
      {d.label}
    </Dropdown.Item>
  ));
}

export interface BreadcrumbItem {
  label: ReactNode;
  to?: LinkProps["to"];
  current?: boolean;
  /** 同層導覽下拉子項目；提供時節點會渲染下拉觸發器 */
  dropdown?: BreadcrumbDropdownItem[];
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  ariaLabel?: string;
  className?: string;
}

function Breadcrumb({
  items,
  ariaLabel = "breadcrumb",
  className = "",
}: BreadcrumbProps) {
  return (
    <nav
      className={`breadcrumb${className ? ` ${className}` : ""}`}
      aria-label={ariaLabel}
    >
      {items.map((item, index) => {
        const key =
          typeof item.label === "string" ? item.label : `breadcrumb-${index}`;
        const isCurrent = item.current === true;
        const hasDropdown = !!item.dropdown && item.dropdown.length > 0;

        return (
          <span key={`${key}-${index}`} className="contents">
            {index > 0 && <span className="separator">/</span>}
            {hasDropdown ? (
              <Dropdown
                trigger={({ isOpen, toggle }) => (
                  <button
                    type="button"
                    className={`breadcrumb-dropdown-trigger${isCurrent ? " current" : ""}`}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    onClick={toggle}
                  >
                    <span>{item.label}</span>
                    <i
                      className={`fa-solid fa-chevron-down breadcrumb-dropdown-chevron${isOpen ? " open" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                )}
              >
                {renderDropdownItems(item.dropdown!)}
              </Dropdown>
            ) : item.to && !isCurrent ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span className={isCurrent ? "current" : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;
