/**
 * 由 Definition 產生 LLM 工具（generator）。
 *
 * MVP 兩個工具：
 *  - fill_fields：擷取並填入欄位（input schema 由 data.schema.properties 生成）
 *  - submit：使用者確認後送出（伺服器端守門，僅 confirming 時可執行）
 */
import type { LLMTool } from '@/lib/llm/types';
import type { Definition } from './form.types';

export function buildTools(def: Definition): LLMTool[] {
  return [
    {
      name: 'fill_fields',
      description:
        `從使用者訊息擷取「${def.agent.description}」的欄位值並填入。` +
        '只填你有把握的欄位；相對日期（明天／下週一等）請換算成 YYYY-MM-DD。' +
        '回傳會告訴你目前缺哪些必填欄位與驗證錯誤。',
      inputSchema: {
        type: 'object',
        properties: {
          fields: {
            type: 'object',
            description: '要填入的欄位，key 為欄位機器名稱',
            properties: def.data.properties,
            additionalProperties: false,
          },
        },
        required: ['fields'],
      },
    },
    {
      name: 'submit',
      description:
        '在所有必填欄位齊全、且使用者已明確回覆「確認」後呼叫，送出表單進入簽核。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'get_leave_balances',
      description:
        '查詢目前登入使用者各假別的可用（剩餘）時數。當使用者詢問「還有多少假」「特休剩幾小時」' +
        '「所有假別剩餘時數」等問題時呼叫。回傳每個假別的機器值與剩餘時數（查無資料的假別不會出現）。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'find_deputy_candidates',
      description:
        '查詢可指定為職務代理人的候選人清單。候選人「一律來自使用者的『我的最愛』」，' +
        '可被推薦或選擇的代理人只能是最愛內的人員。' +
        '可選用 department 在最愛之內再依部門篩選；省略則回全部最愛。' +
        '當使用者要挑代理人、問「有誰可以當代理人」「我的最愛代理人」「行銷部有誰」時呼叫。' +
        '回傳每位候選人的工號、姓名、部門、職稱；代理人欄位值請用「姓名(工號)」格式。',
      inputSchema: {
        type: 'object',
        properties: {
          department: {
            type: 'string',
            description: '在「我的最愛」之內再依部門名稱篩選；省略時回全部最愛',
          },
        },
        additionalProperties: false,
      },
    },
  ];
}
