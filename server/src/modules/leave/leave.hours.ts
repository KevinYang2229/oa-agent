/**
 * 請假時數計算（純函式，無 express / prisma，可離線單測）。
 *
 * 依「地區工時政策」把起訖日期時間換算成實際請假時數：
 *  - 每個工作日只計上下班區間內的時間
 *  - 排除午休（休息）區間
 *  - 整日＝該地區上下班區間扣午休的實際時數（隨地區工時不同）
 *  - 跳過週末（policy.weekendDays，預設六、日）與國定假日（policy.holidays）
 */
import type { FormValues, PolicySchema, WorkTimePolicy } from '@/modules/form/form.types';

/** "HH:mm" → 當日分鐘數 */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 依地區挑工時政策；找不到回 default */
export function resolvePolicy(policy: PolicySchema, region?: string): WorkTimePolicy {
  if (region && policy.regions?.[region]) return policy.regions[region];
  return policy.default;
}

/**
 * 計算單一工作日內、[from, to) 區間扣掉午休後的工時（分鐘）。
 * from/to 會先夾擠到上下班區間內。
 */
function workedMinutesInDay(p: WorkTimePolicy, fromMin: number, toMin: number): number {
  const dayStart = toMinutes(p.workDay.start);
  const dayEnd = toMinutes(p.workDay.end);
  const start = Math.max(fromMin, dayStart);
  const end = Math.min(toMin, dayEnd);
  if (end <= start) return 0;

  let minutes = end - start;
  if (p.lunchBreak) {
    const lunchStart = toMinutes(p.lunchBreak.start);
    const lunchEnd = toMinutes(p.lunchBreak.end);
    const overlap = Math.max(0, Math.min(end, lunchEnd) - Math.max(start, lunchStart));
    minutes -= overlap;
  }
  return Math.max(0, minutes);
}

/**
 * 以日為步進列舉 [startDate, endDate] 之間的每一天（YYYY-MM-DD）。
 * 全程用 UTC 避免本地時區把日期位移一天（toISOString 是 UTC）。
 */
function eachDate(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

/** YYYY-MM-DD → 星期幾（0=日…6=六），以 UTC 計算，與 eachDate 一致 */
function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export interface LeaveHoursResult {
  /** 換算後的請假總時數（小時，保留一位小數） */
  hours: number;
  /** 實際採用的地區（回填 default 時為 undefined） */
  region?: string;
  /** 採用的政策（供顯示／除錯） */
  policy: WorkTimePolicy;
}

/**
 * 計算請假時數。需要 startDate/endDate；startTime/endTime 省略時以整個工作日計。
 * @param region 申請人所屬地區（由 user directory 解析），決定採用哪份工時政策
 */
export function computeLeaveHours(
  values: FormValues,
  policySchema: PolicySchema,
  region?: string,
): LeaveHoursResult {
  const p = resolvePolicy(policySchema, region);
  const startDate = values.startDate as string | undefined;
  const endDate = (values.endDate as string | undefined) ?? startDate;
  const startTime = values.startTime as string | undefined;
  const endTime = values.endTime as string | undefined;

  const result: Omit<LeaveHoursResult, 'hours'> = {
    region: region && policySchema.regions?.[region] ? region : undefined,
    policy: p,
  };
  if (!startDate || !endDate) return { hours: 0, ...result };

  const days = eachDate(startDate, endDate);
  const dayStart = toMinutes(p.workDay.start);
  const dayEnd = toMinutes(p.workDay.end);
  const weekendDays = p.weekendDays ?? [0, 6]; // 0=日…6=六
  const holidays = new Set(policySchema.holidays ?? []);
  let totalMinutes = 0;

  for (let i = 0; i < days.length; i++) {
    const date = days[i];
    // 週末與國定假日不計時數
    if (weekendDays.includes(dayOfWeek(date)) || holidays.has(date)) continue;

    const isFirst = i === 0;
    const isLast = i === days.length - 1;
    // 首日從 startTime（無則上班時間）起；末日到 endTime（無則下班時間）止；中間整日
    const fromMin = isFirst && startTime ? toMinutes(startTime) : dayStart;
    const toMin = isLast && endTime ? toMinutes(endTime) : dayEnd;
    totalMinutes += workedMinutesInDay(p, fromMin, toMin);
  }

  // 直接以淨工時計：整天＝該地區上下班區間扣午休的實際時數（不再正規化成固定值）
  const hours = totalMinutes / 60;

  return { hours: Math.round(hours * 10) / 10, ...result };
}
