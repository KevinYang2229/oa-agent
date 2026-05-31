import React, { forwardRef } from "react";
import "./Badge.css";

export type StatusBadgeVariant =
  | "normal"
  | "process"
  | "urgent"
  | "urge"
  | "danger"
  | "draft"
  | "success"
  | "info"
  | "warning"
  | "default";
export type SimpleBadgeVariant = "primary" | "highlight" | "secondary";

export interface BadgeProps extends React.ComponentProps<"span"> {
  type?: "status" | "simple";
  status?: StatusBadgeVariant;
  variant?: SimpleBadgeVariant;
  children?: React.ReactNode;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      type = "status",
      status = "normal",
      variant,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    let baseClass = "";
    let specificClass = "";

    if (type === "status") {
      baseClass = "status-badge";
      specificClass = `status-${status}`;
    } else if (type === "simple") {
      baseClass = "simple-badge";
      if (variant) {
        specificClass = variant;
      }
    }

    const combinedClasses = [baseClass, specificClass, className]
      .filter(Boolean)
      .join(" ");

    return (
      <span ref={ref} className={combinedClasses} {...props}>
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";

export default Badge;
