"use server";
export type ResultActionState = { message?: string; success?: boolean };
export async function submitActivityResult(): Promise<ResultActionState> {
  return { message: "活動詳細画面からすべての必須項目を入力してください。" };
}
