import React from "react";
import Radio from "../common/Radio/Radio";

interface SearchOptionProps {
  label: React.ReactNode;
  name: string;
  value: string;
  defaultChecked?: boolean;
}

export const SearchOption: React.FC<SearchOptionProps> = ({
  label,
  name,
  value,
  defaultChecked,
}) => (
  <label className="search-option">
    <Radio bare name={name} value={value} defaultChecked={defaultChecked} />
    <span className="option-label">{label}</span>
  </label>
);
