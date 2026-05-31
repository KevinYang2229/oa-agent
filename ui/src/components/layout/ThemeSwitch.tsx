import React from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "../../stores/theme";
import "./ThemeSwitch.css";

export const ThemeSwitch: React.FC = () => {
  const { t } = useTranslation();
  const { isDark, toggle } = useThemeStore();

  return (
    <div className="theme-switch-row">
      <span className="material-symbols-outlined theme-icon" aria-hidden="true">
        light_mode
      </span>
      <label className="theme-switch" htmlFor="theme-switch-checkbox">
        <input
          type="checkbox"
          id="theme-switch-checkbox"
          checked={isDark}
          onChange={toggle}
          aria-label={t("header.appearance")}
        />
        <div className="slider round"></div>
      </label>
      <span className="material-symbols-outlined theme-icon" aria-hidden="true">
        dark_mode
      </span>
    </div>
  );
};
