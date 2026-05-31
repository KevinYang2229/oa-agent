import React, { forwardRef } from "react";
import "./Button.css";

export type ButtonVariant =
  | "confirm"
  | "new"
  | "cancel"
  | "delete"
  | "reset"
  | "form-inline"
  | "uploader"
  | "remove-file"
  | "nav"
  | "icon"
  | "icon-ghost";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<React.ComponentProps<"button">, "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const variantClassMap: Record<ButtonVariant, string> = {
  confirm: "btn-confirm",
  new: "btn-new",
  cancel: "btn-cancel",
  delete: "btn-delete",
  reset: "btn-reset",
  "form-inline": "btn-form-inline",
  uploader: "btn-uploader",
  "remove-file": "btn-remove-file",
  nav: "btn-nav",
  icon: "btn-icon",
  "icon-ghost": "btn-icon-ghost",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
};

const selfSizingVariants = new Set<ButtonVariant>(["form-inline", "uploader", "remove-file", "nav"]);

/** 獨立樣式變體：不套用 .btn 基底與尺寸 class，外觀完全由 variant class 自帶。 */
const standaloneVariants = new Set<ButtonVariant>(["icon-ghost"]);

/** 合併 CSS className，略過空值。 */
const cn = (...classes: Array<string | undefined | false>): string =>
  classes.filter(Boolean).join(" ");

/** 根據按鈕變體與尺寸產生語意 className。 */
const getButtonClasses = (
  variant: ButtonVariant | undefined,
  size: ButtonSize | undefined,
  className: string,
): string => {
  // 獨立樣式變體：略過 .btn 基底與尺寸 class
  if (variant && standaloneVariants.has(variant)) {
    return cn(variantClassMap[variant], className);
  }

  const resolvedSize = size ?? "md";
  const sizeClasses =
    variant && selfSizingVariants.has(variant) && !size ? undefined : sizeClassMap[resolvedSize];

  return cn(
    "btn",
    variant ? variantClassMap[variant] : undefined,
    sizeClasses,
    className,
  );
};

/** 判斷 children 是否完全沒有文字內容（僅由 React 元素組成，例如 <i> icon）。 */
const hasNoTextChildren = (children: React.ReactNode): boolean => {
  let hasElement = false;
  let hasText = false;
  React.Children.forEach(children, (child) => {
    if (child === null || child === undefined || typeof child === "boolean") return;
    if (typeof child === "string") {
      if (child.trim().length > 0) hasText = true;
      return;
    }
    if (typeof child === "number") {
      hasText = true;
      return;
    }
    hasElement = true;
  });
  return hasElement && !hasText;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant, size, icon, children, ...props }, ref) => {
    const isStandalone = Boolean(variant && standaloneVariants.has(variant));
    // 僅有 icon、無文字內容時，按鈕強制呈現 1:1 方形（獨立變體自帶尺寸，不需處理）
    const childrenEmpty = children === undefined || children === null || children === false;
    const isIconOnly =
      !isStandalone &&
      ((Boolean(icon) && childrenEmpty) ||
        (!icon && !childrenEmpty && hasNoTextChildren(children)) ||
        (Boolean(icon) && !childrenEmpty && hasNoTextChildren(children)));
    const combinedClasses = cn(
      getButtonClasses(variant, size, className),
      isIconOnly ? "btn-icon-only" : undefined,
    );

    return (
      <button ref={ref} className={combinedClasses} {...props}>
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
