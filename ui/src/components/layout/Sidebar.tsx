import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useLayoutStore } from "../../stores/layout";
import "./Sidebar.css";

/** 收合狀態下 hover 顯示的 tooltip 位置與內容 */
interface SidebarTooltipState {
  label: string;
  /** tooltip 中線在視窗中的 Y 座標（px） */
  top: number;
  /** tooltip 左邊緣在視窗中的 X 座標（px） */
  left: number;
}

/** 群組對應的路由前綴；命中任一前綴即視為該群組 active */
const GROUP_PATH_PREFIXES: Record<string, string[]> = {
  workflow: [
    "/pending_tasks",
    "/processed_tasks",
    "/closed_tasks",
    "/agent_confirm",
    "/notification_settings",
    "/pending_task_preview",
    "/processed_task_preview",
    "/closed_task_preview",
    "/pending_task_edit",
    "/workflow",
  ],
  admin: ["/outing_registration", "/equipment", "/bulletin_board"],
  esg: ["/esg_survey"],
  settings: ["/employee_profile"],
};

/** 「我的事項」子選單應視為 active 的路由 */
const MY_TASKS_PATHS = new Set([
  "/pending_tasks",
  "/processed_tasks",
  "/closed_tasks",
  "/agent_confirm",
  "/notification_settings",
  "/pending_task_preview",
  "/processed_task_preview",
  "/closed_task_preview",
  "/pending_task_edit",
]);

/** 頂層單一導覽項目 */
interface TopNavItem {
  /** Material Symbols 圖示名稱 */
  icon: string;
  /** 路由路徑 */
  to: string;
  /** 標題 i18n key */
  titleKey: string;
}

/** 側邊欄子選單項目 */
interface NavSubItem {
  /** 標題 i18n key */
  labelKey: string;
  /** SPA 路由路徑；有值則渲染為 <Link> */
  to?: string;
  /** 外部連結；有值則渲染為 <a>（非 SPA 路由） */
  href?: string;
  /** 自訂 active 比對路徑集合；省略則以 to 完全比對 */
  activePaths?: ReadonlySet<string>;
}

/** 側邊欄可展開導覽群組 */
interface NavGroup {
  /** 群組識別 key（對應 openGroups 與 data-group） */
  key: string;
  /** Material Symbols 圖示名稱 */
  icon: string;
  /** 群組標題 i18n key */
  titleKey: string;
  /** 子選單項目 */
  items: NavSubItem[];
}

/** 頂層導覽項目設定 */
const TOP_NAV_ITEMS: TopNavItem[] = [
  { icon: "vitals", to: "/design-system", titleKey: "sidebar.designSystem" },
  { icon: "account_tree", to: "/page_index", titleKey: "sidebar.pageIndex" },
];

/** 可展開導覽群組設定 */
const NAV_GROUPS: NavGroup[] = [
  {
    key: "workflow",
    icon: "hub",
    titleKey: "sidebar.workflow.title",
    items: [
      {
        labelKey: "sidebar.workflow.myTasks",
        to: "/pending_tasks",
        activePaths: MY_TASKS_PATHS,
      },
      { labelKey: "sidebar.workflow.fillForm", to: "/workflow" },
    ],
  },
  {
    key: "admin",
    icon: "key",
    titleKey: "sidebar.admin.title",
    items: [
      {
        labelKey: "sidebar.admin.outingRegistration",
        to: "/outing_registration",
      },
      { labelKey: "sidebar.admin.equipmentBooking", href: "/equipment" },
      { labelKey: "sidebar.admin.bulletinBoard", to: "/bulletin_board" },
      { labelKey: "sidebar.admin.queryStats" },
      { labelKey: "sidebar.admin.formRules" },
    ],
  },
  {
    key: "sales",
    icon: "analytics",
    titleKey: "sidebar.sales.title",
    items: [
      { labelKey: "sidebar.sales.customerList" },
      { labelKey: "sidebar.sales.salesReport" },
      { labelKey: "sidebar.sales.publicCustomers" },
    ],
  },
  {
    key: "project",
    icon: "menu_book",
    titleKey: "sidebar.project.title",
    items: [
      { labelKey: "sidebar.project.projectList" },
      { labelKey: "sidebar.project.progressReport" },
      { labelKey: "sidebar.project.costAnalysis" },
    ],
  },
  {
    key: "invoice",
    icon: "receipt_long",
    titleKey: "sidebar.invoice.title",
    items: [
      { labelKey: "sidebar.invoice.issue" },
      { labelKey: "sidebar.invoice.query" },
      { labelKey: "sidebar.invoice.void" },
    ],
  },
  {
    key: "hr",
    icon: "groups",
    titleKey: "sidebar.hr.title",
    items: [
      { labelKey: "sidebar.hr.employeeData" },
      { labelKey: "sidebar.hr.attendance" },
      { labelKey: "sidebar.hr.salary" },
    ],
  },
  {
    key: "kpi",
    icon: "trending_up",
    titleKey: "sidebar.kpi.title",
    items: [
      { labelKey: "sidebar.kpi.goalSetting" },
      { labelKey: "sidebar.kpi.midReview" },
      { labelKey: "sidebar.kpi.finalReview" },
    ],
  },
  {
    key: "training",
    icon: "co_present",
    titleKey: "sidebar.training.title",
    items: [
      { labelKey: "sidebar.training.onlineCourses" },
      { labelKey: "sidebar.training.registration" },
      { labelKey: "sidebar.training.records" },
    ],
  },
  {
    key: "exam",
    icon: "cloud",
    titleKey: "sidebar.exam.title",
    items: [
      { labelKey: "sidebar.exam.questionBank" },
      { labelKey: "sidebar.exam.examList" },
      { labelKey: "sidebar.exam.scoreQuery" },
    ],
  },
  {
    key: "knowledge",
    icon: "assignment",
    titleKey: "sidebar.knowledge.title",
    items: [
      { labelKey: "sidebar.knowledge.orderQuery" },
      { labelKey: "sidebar.knowledge.dispatch" },
      { labelKey: "sidebar.knowledge.caseReview" },
    ],
  },
  {
    key: "esg",
    icon: "eco",
    titleKey: "sidebar.esg.title",
    items: [{ labelKey: "sidebar.esg.commuteSurvey", to: "/esg_survey" }],
  },
  {
    key: "settings",
    icon: "computer",
    titleKey: "sidebar.settings.title",
    items: [
      {
        labelKey: "sidebar.settings.employeeProfile",
        to: "/employee_profile",
      },
      { labelKey: "sidebar.settings.privateCar" },
      { labelKey: "sidebar.settings.leaveInfo" },
      { labelKey: "sidebar.settings.timesheet" },
      { labelKey: "sidebar.settings.businessTrip" },
      { labelKey: "sidebar.settings.password" },
      { labelKey: "sidebar.settings.performanceRecord" },
    ],
  },
];

/** 依目前路徑判斷某群組是否 active */
function isGroupActive(group: string, pathname: string): boolean {
  const prefixes = GROUP_PATH_PREFIXES[group];
  if (!prefixes) return false;
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** 左側導覽側邊欄 */
export function Sidebar() {
  const { t } = useTranslation();
  const { isSidebarCollapsed, toggleSidebar, setSidebarCollapsed } =
    useLayoutStore();
  const [tooltip, setTooltip] = useState<SidebarTooltipState | null>(null);

  /** 收合狀態下：滑入 nav-item 計算 rect、設定 fixed tooltip 位置 */
  const handleNavItemEnter = (
    e: React.MouseEvent<HTMLElement>,
    label: string,
  ) => {
    if (!isSidebarCollapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  };

  const handleNavItemLeave = () => {
    if (tooltip) setTooltip(null);
  };

  // 切換收合狀態或捲動時，立即清除 tooltip 避免殘留錯位
  useEffect(() => {
    if (!isSidebarCollapsed && tooltip) setTooltip(null);
  }, [isSidebarCollapsed, tooltip]);
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    Object.keys(GROUP_PATH_PREFIXES).filter((g) =>
      isGroupActive(g, location.pathname),
    ),
  );

  // 路徑變動時，自動展開命中的群組
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      Object.keys(GROUP_PATH_PREFIXES).forEach((g) => {
        if (isGroupActive(g, location.pathname)) next.add(g);
      });
      return Array.from(next);
    });
  }, [location.pathname]);

  const toggleGroup = (label: string, e: React.MouseEvent) => {
    e.preventDefault();
    // 收合狀態下點擊有子項目的群組：先展開側邊欄、確保群組 open、捲動到該群組
    if (isSidebarCollapsed) {
      const groupEl = (e.currentTarget as HTMLElement).closest(".nav-group");
      setSidebarCollapsed(false);
      setTooltip(null);
      setOpenGroups((prev) =>
        prev.includes(label) ? prev : [...prev, label],
      );
      // 等待寬度展開（CSS 400ms）+ 子選單展開（CSS 300ms）後再捲動
      window.setTimeout(() => {
        groupEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 320);
      return;
    }
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label],
    );
  };

  const isActive = (path: string) => location.pathname === path;

  /** 判斷子選單項目是否為 active 狀態 */
  const isSubItemActive = (item: NavSubItem): boolean => {
    if (item.activePaths) return item.activePaths.has(location.pathname);
    return item.to ? isActive(item.to) : false;
  };

  /** 依型態渲染單一子選單項目（SPA 路由 / 外部連結 / 純文字佔位） */
  const renderSubItem = (item: NavSubItem) => {
    const label = t(item.labelKey);
    if (item.to) {
      return (
        <Link
          key={item.labelKey}
          to={item.to}
          className={`sub-item ${isSubItemActive(item) ? "active" : ""}`}
        >
          {label}
        </Link>
      );
    }
    if (item.href) {
      return (
        <a key={item.labelKey} href={item.href} className="sub-item">
          {label}
        </a>
      );
    }
    return (
      <div key={item.labelKey} className="sub-item">
        {label}
      </div>
    );
  };

  return (
    <aside className="sidebar">
      <h1>
        <Link
          to="/"
          aria-label={t("sidebar.home")}
          className="inline-flex items-center text-inherit"
        >
          <img src="/images/hy_logo.png" alt="Hyweb" />
          <span className="sidebar-brand-text">{t("header.title")}</span>
        </Link>
      </h1>
      <button
        id="left-sidebar-toggle"
        className="sidebar-toggle-btn"
        aria-label={t("sidebar.toggle")}
        onClick={toggleSidebar}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {isSidebarCollapsed ? "chevron_right" : "chevron_left"}
        </span>
      </button>
      <div className="avatar-container">
        <img
          src="https://i.pravatar.cc/150?img=11"
          alt="User Avatar"
          className="avatar"
        />
        <div className="employee-info">
          <span className="employee-name">Alex 蔡承恩</span>
          <span className="employee-id">HYW032</span>
          <span className="employee-department">R01 資訊軟體開發部</span>
        </div>
      </div>
      <nav className="nav-menu" onScroll={handleNavItemLeave}>
        {TOP_NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`nav-item ${isActive(item.to) ? "active" : ""}`}
            onMouseEnter={(e) => handleNavItemEnter(e, t(item.titleKey))}
            onMouseLeave={handleNavItemLeave}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {item.icon}
            </span>
            <span className="nav-text">{t(item.titleKey)}</span>
          </Link>
        ))}

        {NAV_GROUPS.map((group) => {
          const isOpen = openGroups.includes(group.key);
          const groupTitle = t(group.titleKey);
          return (
            <div
              key={group.key}
              className={`nav-group ${isOpen ? "open" : ""}`}
              data-group={group.key}
            >
              <button
                className={`nav-item ${isGroupActive(group.key, location.pathname) ? "active" : ""}`}
                aria-haspopup="true"
                aria-expanded={isOpen}
                onClick={(e) => toggleGroup(group.key, e)}
                onMouseEnter={(e) => handleNavItemEnter(e, groupTitle)}
                onMouseLeave={handleNavItemLeave}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {group.icon}
                </span>
                <span className="nav-text">{groupTitle}</span>
                <span
                  className="material-symbols-outlined arrow-icon"
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </button>
              <div className="sub-menu">{group.items.map(renderSubItem)}</div>
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-copyright">
          <p>{t("sidebar.copyright")}</p>
        </div>
      </div>
      {tooltip &&
        isSidebarCollapsed &&
        createPortal(
          <div
            className="sidebar-tooltip"
            style={{ top: tooltip.top, left: tooltip.left }}
            role="tooltip"
          >
            {tooltip.label}
          </div>,
          document.body,
        )}
    </aside>
  );
}
