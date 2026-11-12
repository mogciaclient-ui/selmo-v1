import Link from "next/link";
import type { DashboardActivity } from "@/domain/dashboard/types";
export function ResultDialog({ activity }: { activity: DashboardActivity }) {
  return <Link href={`/activities/${activity.id}/report`} className="rounded-lg bg-[#f2c94c] px-4 py-2 text-sm font-bold">活動詳細・結果入力</Link>;
}
