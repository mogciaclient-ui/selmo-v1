export const defaultProductNames = [
  "ビジネスフォン", "FAX", "複合機", "UTM", "サーバー", "ネットワーク商材", "防犯カメラ",
  "アルファ電気", "コラボ", "LED", "UPS・SSW・ルーター", "その他", "アルファサポート",
  "CS事業部", "商材未定",
] as const;

/** AXCEL は selmo の商材として扱わない。商材マスタ（DB）に残っていても選択肢には出さない。 */
export function isExcludedProduct(name: string) {
  return /AXCEL|ＡＸＣＥＬ/i.test(name.normalize("NFKC"));
}

export function productOptions(names: string[]) {
  const visible = names.filter((name) => !isExcludedProduct(name));
  return visible.length ? visible : [...defaultProductNames];
}
