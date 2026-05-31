import React, { forwardRef } from "react";
import "./Alert.css";

export type AlertVariant = "success" | "info" | "warning" | "danger";

export interface AlertProps extends React.ComponentProps<"div"> {
  variant?: AlertVariant;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  /** 顯示右側關閉按鈕，點擊時觸發 */
  onClose?: () => void;
  /** 關閉按鈕 aria-label，預設「關閉」 */
  closeLabel?: string;
}

const variantIconMap: Record<AlertVariant, React.ReactNode> = {
  success: <i className="fa-solid fa-circle-check"></i>,
  info: <i className="fa-solid fa-circle-info"></i>,
  warning: <i className="fa-solid fa-triangle-exclamation"></i>,
  danger: <i className="fa-solid fa-circle-exclamation"></i>,
};

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = "info",
      icon,
      className = "",
      children,
      onClose,
      closeLabel = "關閉",
      ...props
    },
    ref,
  ) => {
    const combinedClasses = ["form-alert", variant, className].filter(Boolean).join(" ");
    const displayIcon = icon || variantIconMap[variant];

    return (
      <div ref={ref} className={combinedClasses} {...props}>
        {displayIcon}
        <span>{children}</span>
        {onClose && (
          <button
            type="button"
            className="form-alert-close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = "Alert";

export default Alert;
