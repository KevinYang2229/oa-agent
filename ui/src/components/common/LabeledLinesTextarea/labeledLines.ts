/** 解析多行字串為各行的值（去掉行首固定標籤） */
export function parseLabeledValues(labels: string[], text: string): string[] {
  const lines = text.split("\n");
  return labels.map((label, i) => {
    const line = lines[i] ?? "";
    return line.startsWith(label) ? line.slice(label.length) : "";
  });
}

/** 由標籤與各行的值組成多行字串（每行：label + value） */
export function buildLabeledText(labels: string[], values: string[]): string {
  return labels.map((label, i) => `${label}${values[i] ?? ""}`).join("\n");
}

/** 以空值初始化（每行僅含固定標籤），作為表單預設值 */
export function initLabeledText(labels: string[]): string {
  return labels.join("\n");
}

/**
 * 驗證使用者編輯後的新文字是否仍保有完整結構：
 * 行數不變、且每行皆以對應標籤開頭。通過才允許套用。
 */
export function isLabeledTextValid(labels: string[], text: string): boolean {
  const lines = text.split("\n");
  if (lines.length !== labels.length) return false;
  return labels.every((label, i) => lines[i].startsWith(label));
}
