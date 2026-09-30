export const defaultProductNames = [
  "AXCEL", "ビジネスフォン", "FAX", "複合機", "UTM", "サーバー", "ネットワーク商材", "防犯カメラ",
  "ＡＸＣＥＬ", "アルファ電気", "コラボ", "LED", "UPS・SSW・ルーター", "その他", "アルファサポート",
  "CS事業部", "商材未定",
] as const;

export function productOptions(names: string[]) {
  return names.length ? names : [...defaultProductNames];
}
