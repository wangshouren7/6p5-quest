import { pathnames } from "@/modules/ui/pathnames";
import { redirect } from "next/navigation";

export default function Home() {
  redirect(pathnames.corpus());
}
