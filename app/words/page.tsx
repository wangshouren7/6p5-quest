import { redirect } from "next/navigation";

/** 兼容旧链接：/words 重定向到 /vocabulary */
export default function WordsPage() {
  redirect("/vocabulary");
}
