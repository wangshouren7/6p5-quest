/**
 * 从 unknown 异常中提取可展示的错误信息。
 * @param e 捕获的异常
 * @param fallback 非 Error 或无 message 时的默认文案
 */
export function getErrorMessage(e: unknown, fallback = "操作失败"): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}
