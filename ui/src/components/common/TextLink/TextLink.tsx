import React, { forwardRef } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import "./TextLink.css";

/** 文字連結的視覺變體。 */
export type TextLinkVariant = "default" | "subtle" | "danger";

/** 文字連結的尺寸（依字級）。 */
export type TextLinkSize = "sm" | "md" | "lg";

/** 底線顯示策略：hover 時、總是、不顯示。 */
export type TextLinkUnderline = "hover" | "always" | "none";

interface TextLinkBaseProps {
  /** 視覺變體，預設 `default`。 */
  variant?: TextLinkVariant;
  /** 字級尺寸，預設 `md`。 */
  size?: TextLinkSize;
  /** 底線顯示策略，預設 `always`。 */
  underline?: TextLinkUnderline;
  /** 左側 icon（建議搭配 `<i>` 或 material-symbols）。 */
  icon?: React.ReactNode;
  /** 右側 icon（常見如外部連結箭頭）。 */
  trailingIcon?: React.ReactNode;
  /** 禁用狀態。 */
  disabled?: boolean;
  /** 連結文字內容。 */
  children?: React.ReactNode;
  /** 額外的 className。 */
  className?: string;
}

/** 內部路由模式：使用 TanStack Router 的 `Link`。 */
type TextLinkInternalProps = TextLinkBaseProps &
  Omit<LinkProps, "children" | "className"> & {
    to: LinkProps["to"];
    href?: never;
  };

/** 外部連結模式：使用原生 `<a>`。 */
type TextLinkExternalProps = TextLinkBaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className"> & {
    href: string;
    to?: never;
    /** 是否作為外部連結開啟（自動加上 `target="_blank"` 與安全 `rel`）。 */
    external?: boolean;
  };

export type TextLinkProps = TextLinkInternalProps | TextLinkExternalProps;

const variantClassMap: Record<TextLinkVariant, string> = {
  default: "",
  subtle: "text-link-subtle",
  danger: "text-link-danger",
};

const sizeClassMap: Record<TextLinkSize, string> = {
  sm: "text-link-sm",
  md: "text-link-md",
  lg: "text-link-lg",
};

const underlineClassMap: Record<TextLinkUnderline, string> = {
  hover: "text-link-underline-hover",
  always: "text-link-underline-always",
  none: "text-link-underline-none",
};

/** 合併 CSS className，略過空值。 */
const cn = (...classes: Array<string | undefined | false>): string =>
  classes.filter(Boolean).join(" ");

/** 依變體、尺寸與底線策略產生語意 className。 */
const getTextLinkClasses = (
  variant: TextLinkVariant,
  size: TextLinkSize,
  underline: TextLinkUnderline,
  disabled: boolean,
  className: string,
): string =>
  cn(
    "text-link",
    variantClassMap[variant],
    sizeClassMap[size],
    underlineClassMap[underline],
    disabled ? "text-link-disabled" : undefined,
    className,
  );

/**
 * 統一風格的文字連結元件。
 * - 傳入 `to` 走 TanStack Router 內部導航；傳入 `href` 走原生 `<a>`。
 * - 支援 `variant`、`size`、`underline`、`icon` / `trailingIcon`、`disabled`。
 */
const TextLink = forwardRef<HTMLAnchorElement, TextLinkProps>((props, ref) => {
  const {
    variant = "default",
    size = "md",
    underline = "always",
    icon,
    trailingIcon,
    disabled = false,
    children,
    className = "",
    ...rest
  } = props;

  const classes = getTextLinkClasses(variant, size, underline, disabled, className);

  const content = (
    <>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {trailingIcon && <span className="shrink-0">{trailingIcon}</span>}
    </>
  );

  // 外部連結模式：使用原生 <a>
  if ("href" in rest && rest.href !== undefined) {
    const { href, external, target, rel, onClick, ...anchorRest } =
      rest as TextLinkExternalProps;
    const resolvedTarget = target ?? (external ? "_blank" : undefined);
    const resolvedRel =
      rel ?? (resolvedTarget === "_blank" ? "noopener noreferrer" : undefined);

    return (
      <a
        ref={ref}
        href={disabled ? undefined : href}
        target={resolvedTarget}
        rel={resolvedRel}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        className={classes}
        onClick={disabled ? (event) => event.preventDefault() : onClick}
        {...anchorRest}
      >
        {content}
      </a>
    );
  }

  // 內部導航模式：TanStack Router Link
  const linkProps = rest as TextLinkInternalProps;
  return (
    <Link
      ref={ref}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={classes}
      disabled={disabled || undefined}
      {...linkProps}
    >
      {content}
    </Link>
  );
});

TextLink.displayName = "TextLink";

export default TextLink;
