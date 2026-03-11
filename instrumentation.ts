/**
 * Next.js 服务端启动时注册；仅在 Node 运行时执行。
 * 定时执行词汇 AI 回填任务（读 PENDING、调 LLM、写库更新 Task）。
 * 使用 running 锁避免上一轮未结束时重复执行（如间隔 3s 但单轮耗时 >3s）。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runVocabularyAiFillBatch } =
    await import("@/modules/vocabulary/actions");
  const INTERVAL_MS = 3 * 1000;
  let running = false;

  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runVocabularyAiFillBatch();
    } catch (e) {
      console.error("[instrumentation] runVocabularyAiFillBatch error", e);
    } finally {
      running = false;
    }
  }, INTERVAL_MS);
}
