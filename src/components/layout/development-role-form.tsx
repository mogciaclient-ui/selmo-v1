"use client";

import { useState, type ReactNode } from "react";

export function DevelopmentRoleForm({ children, className, buttonClassName }: {
  children: ReactNode;
  className: string;
  buttonClassName: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <form
      method="post"
      action="/api/auth/development-role"
      className={className}
      onSubmit={event => {
        if (pending) event.preventDefault();
        else setPending(true);
      }}
    >
      {children}
      <button type="submit" disabled={pending} aria-busy={pending} className={buttonClassName}>
        {pending ? "切り替え中…" : "切り替え"}
      </button>
    </form>
  );
}
