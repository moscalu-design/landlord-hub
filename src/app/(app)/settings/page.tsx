import { auth } from "@/lib/auth";
import { TopBar } from "@/components/layout/TopBar";

const ROADMAP = [
  "Change password",
  "Email notifications for overdue rent",
  "CSV export of payment history",
  "Currency and locale settings",
  "Multi-user access",
];

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="flex flex-col flex-1">
      <TopBar title="Settings" description="Manage your account and preferences" />

      <div className="flex-1 p-4 sm:p-6 space-y-5 max-w-2xl">
        {/* Account */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Account</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-lg shrink-0">
              {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">{session?.user?.name}</p>
              <p className="text-sm text-slate-500 truncate">{session?.user?.email}</p>
            </div>
          </div>
        </div>

        {/* Roadmap */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-800">On the roadmap</h2>
          <p className="text-xs text-slate-500 mt-1">Features coming soon.</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-500">
            {ROADMAP.map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
