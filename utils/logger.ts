/** 仅开发环境输出，生产环境不打印 */
export const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.log(...args);
};

export const devWarn = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.warn(...args);
};

export const devError = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.error(...args);
};
