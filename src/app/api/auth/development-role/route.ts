import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { DEVELOPMENT_ROLE_COOKIE } from "@/lib/auth/development-role";
import { authRoles } from "@/lib/auth/roles";
import { LEGACY_UI_COOKIE, LEGACY_UI_OPTION, LEGACY_UI_ROLE } from "@/lib/auth/view-mode";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || URL.parse(origin)?.host !== host) {
    return NextResponse.json({ message: "リクエスト元を確認できませんでした。" }, { status: 403 });
  }

  const context = await getCurrentUser();
  if (!context?.canSwitchRole) {
    return NextResponse.json({ message: "ロール切り替えの権限がありません。" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const requested = form?.get("role");
  const legacy = requested === LEGACY_UI_OPTION;
  const role = legacy ? LEGACY_UI_ROLE : authRoles.find(candidate => candidate === requested);
  if (!role) {
    return NextResponse.json({ message: "ロールが不正です。" }, { status: 400 });
  }

  // A browser navigation loads the destination after accepting the role cookies.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: legacy ? "/dashboard" : "/", "Cache-Control": "no-store" },
  });
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" } as const;
  response.cookies.set(DEVELOPMENT_ROLE_COOKIE, `${context.firebaseUid}:${role}`, options);
  if (legacy) response.cookies.set(LEGACY_UI_COOKIE, context.firebaseUid, options);
  else response.cookies.set(LEGACY_UI_COOKIE, "", { ...options, maxAge: 0 });
  return response;
}
