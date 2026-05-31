import React, { forwardRef } from "react";
import "./Checkbox.css";

export interface CheckboxProps extends React.ComponentProps<"input"> {
  label?: React.ReactNode;
  containerClassName?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", label, containerClassName = "ds-inline-check-row", ...props }, ref) => {
    const checkboxNode = (
      <span className="form-checkbox-wrap">
        <input
          ref={ref}
          type="checkbox"
          className={["form-checkbox", className].filter(Boolean).join(" ")}
          {...props}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="form-checkbox-tick"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );

    if (label) {
      return (
        <label className={containerClassName}>
          {checkboxNode} {label}
        </label>
      );
    }

    return checkboxNode;
  }
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
