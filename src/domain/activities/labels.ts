const activityTypes: Record<string, string> = {
  visit: "訪問",
  online: "オンライン",
  telephone: "電話・テレアポ",
  other: "その他",
};

const activityStatuses: Record<string, string> = {
  scheduled: "予定",
  completed: "実施済み",
  cancelled: "中止",
  canceled: "中止",
};

export function activityTypeLabel(value: string): string {
  return activityTypes[value] ?? value;
}

export function activityStatusLabel(value: string): string {
  return activityStatuses[value] ?? value;
}
