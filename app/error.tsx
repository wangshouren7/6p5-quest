"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-medium text-error">出错了</h2>
      <p className="max-w-md text-center text-sm text-base-content/80">
        {error.message || "页面加载时发生错误"}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => reset()}
        >
          重试
        </button>
        <Link href="/" className="btn btn-ghost btn-sm">
          返回首页
        </Link>
      </div>
    </div>
  );
}
