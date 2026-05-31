import React, { forwardRef } from "react";
import "./Select.css";

export interface SelectProps extends React.ComponentProps<"select"> {
  children?: React.ReactNode;
  error?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", children, error, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={["form-select", error && "form-select--error", className]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={error}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";

export default Select;
