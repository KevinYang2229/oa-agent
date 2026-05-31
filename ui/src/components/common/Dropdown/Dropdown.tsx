import { Link, type LinkProps } from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** 觸發器 render prop 接收的控制 API */
interface DropdownTriggerApi {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

interface DropdownProps {
  /** 觸發器元素 render prop */
  trigger: (api: DropdownTriggerApi) => ReactNode;
  /** 下拉選單內容；通常為一系列 `Dropdown.Item` */
  children: ReactNode;
  /** 對齊方向（相對於觸發器） */
  align?: "start" | "end";
  /** 額外傳遞給選單容器的 className */
  menuClassName?: string;
  /** 選單 aria-label，預設為 menu */
  ariaLabel?: string;
}

interface DropdownItemProps {
  /** 連結目標路徑；提供時渲染為 `<Link>` */
  to?: LinkProps["to"];
  /** 外部連結（非 SPA 路由）；提供時渲染為 `<a>` */
  href?: string;
  /** 點擊事件；如同時提供 `to` 也會觸發 */
  onClick?: () => void;
  /** 額外 className */
  className?: string;
  /** 是否停用 */
  disabled?: boolean;
  /** 是否為目前所在頁（清單中標示 active 狀態並設定 aria-current） */
  active?: boolean;
  /** 巢狀子選單內容；提供時此項目成為子選單觸發器，hover / focus 時展開於右側 */
  submenu?: ReactNode;
  children: ReactNode;
}

/** 下拉選單 close 函式 context，供 `Dropdown.Item` 點擊後自動關閉 */
const DropdownCloseContext = createContext<(() => void) | null>(null);

/**
 * 通用下拉選單元件
 *
 * 採 render prop 觸發器 + compound `Dropdown.Item` 子項目。
 * 內建：點擊外部關閉、Esc 關閉、a11y `aria-haspopup="menu"` / `aria-expanded`、
 * 子項目點擊自動關閉。
 */
function Dropdown({
  trigger,
  children,
  align = "start",
  menuClassName = "",
  ariaLabel = "menu",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((v) => !v);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  return (
    <span ref={wrapperRef} className="dropdown">
      {trigger({ isOpen, toggle, close })}
      {isOpen && (
        <ul
          role="menu"
          aria-label={ariaLabel}
          className={`dropdown-menu dropdown-menu-${align}${
            menuClassName ? ` ${menuClassName}` : ""
          }`}
        >
          <DropdownCloseContext.Provider value={close}>
            {children}
          </DropdownCloseContext.Provider>
        </ul>
      )}
    </span>
  );
}

/**
 * 下拉子項目
 *
 * 提供 `to` 時渲染為 `<Link>`；否則為 `<button>`。
 * 點擊後自動關閉所屬 Dropdown。
 */
function DropdownItem({
  to,
  href,
  onClick,
  className = "",
  disabled = false,
  active = false,
  submenu,
  children,
}: DropdownItemProps) {
  const close = useContext(DropdownCloseContext);
  const [submenuOpen, setSubmenuOpen] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    close?.();
  };

  const itemClassName = `dropdown-item${active ? " active" : ""}${className ? ` ${className}` : ""}`;

  if (submenu) {
    return (
      <li
        role="none"
        className="dropdown-subwrap"
        onMouseEnter={() => setSubmenuOpen(true)}
        onMouseLeave={() => setSubmenuOpen(false)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setSubmenuOpen(false);
          }
        }}
      >
        <button
          type="button"
          role="menuitem"
          className={`${itemClassName} dropdown-item-has-submenu`}
          aria-haspopup="menu"
          aria-expanded={submenuOpen}
          disabled={disabled}
          onClick={() => setSubmenuOpen((v) => !v)}
          onFocus={() => setSubmenuOpen(true)}
        >
          <span className="dropdown-item-label">{children}</span>
          <i
            className="fa-solid fa-chevron-right dropdown-submenu-chevron"
            aria-hidden="true"
          />
        </button>
        {submenuOpen && (
          <ul role="menu" className="dropdown-menu dropdown-submenu">
            {submenu}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li role="none">
      {to && !disabled ? (
        <Link
          to={to}
          role="menuitem"
          className={itemClassName}
          onClick={handleClick}
          aria-disabled={disabled || undefined}
          aria-current={active ? "page" : undefined}
        >
          {children}
        </Link>
      ) : href && !disabled ? (
        <a
          href={href}
          role="menuitem"
          className={itemClassName}
          onClick={handleClick}
          aria-current={active ? "page" : undefined}
        >
          {children}
        </a>
      ) : (
        <button
          type="button"
          role="menuitem"
          className={itemClassName}
          onClick={handleClick}
          disabled={disabled}
          aria-current={active ? "page" : undefined}
        >
          {children}
        </button>
      )}
    </li>
  );
}

/** 分隔線；用於切割不同群組的選項 */
function DropdownDivider() {
  return <li role="separator" className="dropdown-divider" aria-hidden="true" />;
}

interface DropdownHeaderProps {
  children: ReactNode;
  className?: string;
}

/** 群組標題；非互動式，用於標示選項類別 */
function DropdownHeader({ children, className = "" }: DropdownHeaderProps) {
  return (
    <li
      role="presentation"
      className={`dropdown-header${className ? ` ${className}` : ""}`}
    >
      {children}
    </li>
  );
}

interface DropdownSectionProps {
  /** 區塊標題（可選） */
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * 群組容器；包含一組相關選項，並可附帶標題。
 * 多個 Section 之間會自動加上分隔線（透過 CSS 處理）。
 */
function DropdownSection({
  title,
  children,
  className = "",
}: DropdownSectionProps) {
  return (
    <li
      role="group"
      className={`dropdown-section${className ? ` ${className}` : ""}`}
    >
      {title && <div className="dropdown-section-title">{title}</div>}
      <ul role="none" className="dropdown-section-list">
        {children}
      </ul>
    </li>
  );
}

Dropdown.Item = DropdownItem;
Dropdown.Divider = DropdownDivider;
Dropdown.Header = DropdownHeader;
Dropdown.Section = DropdownSection;

export default Dropdown;
