"use client";

import { useState, useTransition } from "react";
import {
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
} from "@/actions/security";

export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startSetup() {
    setMessage(null);
    startTransition(async () => {
      try {
        setSetup(await beginTwoFactorSetup());
      } catch {
        setMessage("Could not start two-factor setup.");
      }
    });
  }

  function confirmSetup() {
    setMessage(null);
    const formData = new FormData();
    formData.set("totpCode", code);
    startTransition(async () => {
      const result = await confirmTwoFactorSetup(formData);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setSetup(null);
      setCode("");
      setMessage("Two-factor authentication is enabled.");
    });
  }

  function disable() {
    setMessage(null);
    startTransition(async () => {
      await disableTwoFactor();
      setMessage("Two-factor authentication is disabled.");
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Two-factor authentication</h2>
          <p className="mt-1 text-sm text-slate-600">
            Use an authenticator app to add a one-time code at sign in.
          </p>
        </div>

        {enabled ? (
          <button
            type="button"
            onClick={disable}
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
          >
            Disable 2FA
          </button>
        ) : (
          <button
            type="button"
            onClick={startSetup}
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Set up 2FA
          </button>
        )}
      </div>

      {!enabled && setup && (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            Add this setup URI or secret in your authenticator app, then enter the 6-digit code.
          </p>
          <div className="space-y-2 text-xs text-slate-600">
            <p className="break-all rounded bg-white p-2 font-mono">{setup.otpauthUri}</p>
            <p className="break-all rounded bg-white p-2 font-mono">{setup.secret}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              placeholder="123456"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={confirmSetup}
              disabled={isPending}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              Enable
            </button>
          </div>
        </div>
      )}

      {message && (
        <div role="status" className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {message}
        </div>
      )}
    </div>
  );
}
