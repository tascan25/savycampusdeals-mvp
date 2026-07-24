import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, BadgeCheck, CalendarDays, Loader2, QrCode, School, Users,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import api from "@/lib/api";

const STATUS_COLORS = {
  active: "#fbbf24",
  redeemed: "#34d399",
  expired: "#71717a",
};

const indiaDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

const presetDates = (days) => {
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { dateFrom: indiaDate(from), dateTo: indiaDate(now) };
};

const shortDate = (value) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
}).format(new Date(`${value}T12:00:00+05:30`));

const shortCollege = (value) => (
  value.length > 21 ? `${value.slice(0, 20)}…` : value
);

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  color: "#fff",
};

function EmptyChart({ message }) {
  return (
    <div className="grid h-full place-items-center rounded-xl border border-dashed border-white/10 text-center text-sm text-zinc-500">
      {message}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const initialDates = useMemo(() => presetDates(30), []);
  const [preset, setPreset] = useState("30");
  const [dateFrom, setDateFrom] = useState(initialDates.dateFrom);
  const [dateTo, setDateTo] = useState(initialDates.dateTo);

  const analytics = useQuery({
    queryKey: ["admin-analytics", dateFrom, dateTo],
    queryFn: async () => (await api.get("/admin/analytics", {
      params: { date_from: dateFrom, date_to: dateTo },
    })).data,
    enabled: Boolean(dateFrom && dateTo && dateFrom <= dateTo),
  });

  const setPresetRange = (value) => {
    setPreset(value);
    if (value !== "custom") {
      const dates = presetDates(Number(value));
      setDateFrom(dates.dateFrom);
      setDateTo(dates.dateTo);
    }
  };

  const summary = analytics.data?.summary;
  const collegeData = analytics.data?.college_registrations || [];
  const trendData = analytics.data?.trend || [];
  const statusData = (analytics.data?.redemption_status || []).filter((item) => item.count > 0);
  const funnel = analytics.data?.verification_funnel;
  const funnelMax = Math.max(1, funnel?.registered || 0);
  const invalidRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const cards = [
    {
      label: "Registrations",
      value: summary?.registrations,
      detail: `${summary?.total_students ?? 0} students all time`,
      icon: Users,
      tint: "text-indigo-300",
    },
    {
      label: "Verified students",
      value: summary?.verified_students,
      detail: `${summary?.approvals ?? 0} approved in this period`,
      icon: BadgeCheck,
      tint: "text-emerald-300",
    },
    {
      label: "Overall verification rate",
      value: summary ? `${summary.verification_rate}%` : undefined,
      detail: "Verified students ÷ all students",
      icon: Activity,
      tint: "text-violet-300",
    },
    {
      label: "Outlet redemptions",
      value: summary?.redemptions,
      detail: `${summary?.issued ?? 0} QR codes issued in this period`,
      icon: QrCode,
      tint: "text-cyan-300",
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Business intelligence</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold">Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Monitor student growth, verification progress, college reach and outlet activity.
          </p>
        </div>
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-[auto_1fr_1fr]">
          <select
            aria-label="Analytics date range"
            value={preset}
            onChange={(event) => setPresetRange(event.target.value)}
            className="rounded-xl border border-white/10 bg-[#17171b] px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#17171b] px-3 text-xs text-zinc-400">
            From
            <input
              aria-label="Analytics from date"
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(event) => { setPreset("custom"); setDateFrom(event.target.value); }}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none"
            />
          </label>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#17171b] px-3 text-xs text-zinc-400">
            To
            <input
              aria-label="Analytics to date"
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(event) => { setPreset("custom"); setDateTo(event.target.value); }}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none"
            />
          </label>
        </div>
      </div>

      {invalidRange && (
        <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-200">
          The end date must be on or after the start date.
        </p>
      )}
      {analytics.isError && (
        <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
          Analytics could not be loaded. Check the date range and try again.
        </p>
      )}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon, tint }) => (
          <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <Icon size={19} className={tint} />
            <p className="mt-4 text-sm text-zinc-400">{label}</p>
            <p className="mt-1 font-display text-3xl font-extrabold" data-testid={`analytics-${label.toLowerCase().replaceAll(" ", "-")}`}>
              {analytics.isLoading ? "—" : value ?? 0}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{analytics.isLoading ? "Loading current data…" : detail}</p>
          </article>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Activity over time</h2>
            <p className="mt-1 text-sm text-zinc-500">Daily registrations, verification approvals and outlet redemptions.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <CalendarDays size={14} />
            {analytics.data?.period ? `${analytics.data.period.date_from} — ${analytics.data.period.date_to}` : "Selected period"}
          </div>
        </div>
        <div className="mt-6 h-80 min-w-0" role="img" aria-label="Line chart of registrations, approvals and redemptions over time">
          {analytics.isLoading ? (
            <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
          ) : trendData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 12, left: -18, bottom: 5 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} stroke="#71717a" tick={{ fontSize: 11 }} minTickGap={26} />
                <YAxis allowDecimals={false} stroke="#71717a" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={shortDate} />
                <Line type="monotone" dataKey="registrations" name="Registrations" stroke="#818cf8" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="approvals" name="Approvals" stroke="#34d399" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="redemptions" name="Redemptions" stroke="#c084fc" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="No activity is available for this period." />}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 xl:col-span-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold">Registrations by college</h2>
              <p className="mt-1 text-sm text-zinc-500">Leading colleges among students registered in this period.</p>
            </div>
            <School className="shrink-0 text-indigo-300" size={20} />
          </div>
          <div
            className="mt-6 h-[390px] min-w-0"
            role="img"
            aria-label="Horizontal bar chart showing student registrations by college"
            data-testid="analytics-college-chart"
          >
            {analytics.isLoading ? (
              <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
            ) : collegeData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collegeData} layout="vertical" margin={{ top: 0, right: 10, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke="#71717a" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="college" width={138} tickFormatter={shortCollege} stroke="#a1a1aa" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="registrations" name="Registrations" fill="#818cf8" radius={[0, 6, 6, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="No registrations with college information were found." />}
          </div>
          <ul className="sr-only">
            {collegeData.map((item) => (
              <li key={item.college}>{item.college}: {item.registrations} registrations</li>
            ))}
          </ul>
          {!analytics.isLoading && (
            <p className="mt-3 text-xs text-zinc-500">
              {analytics.data?.registrations_without_college || 0} registrations in this period did not include a college.
            </p>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 xl:col-span-2">
          <h2 className="font-display text-xl font-bold">Verification funnel</h2>
          <p className="mt-1 text-sm text-zinc-500">All-time progress from account creation to approval.</p>
          <div className="mt-7 space-y-6">
            {[
              ["Registered", funnel?.registered || 0, "bg-indigo-400"],
              ["Submitted", funnel?.submitted || 0, "bg-violet-400"],
              ["Approved", funnel?.approved || 0, "bg-emerald-400"],
            ].map(([label, value, color]) => (
              <div key={label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{label}</span>
                  <span className="font-semibold">{analytics.isLoading ? "—" : value}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${color} transition-[width] duration-300`}
                    style={{ width: analytics.isLoading ? "0%" : `${Math.min(100, value / funnelMax * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-9 border-t border-white/[0.07] pt-6">
            <h3 className="font-display font-bold">Issued QR status</h3>
            <p className="mt-1 text-xs text-zinc-500">Current status of outlet QR codes issued in this period.</p>
            <div className="mt-4 h-48" role="img" aria-label="Donut chart of active, redeemed and expired QR codes">
              {analytics.isLoading ? (
                <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
              ) : statusData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="status" innerRadius={48} outerRadius={72} paddingAngle={3}>
                      {statusData.map((item) => <Cell key={item.status} fill={STATUS_COLORS[item.status]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart message="No outlet QR codes were issued." />}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
              {(analytics.data?.redemption_status || []).map((item) => (
                <div key={item.status} className="flex items-center gap-1.5 text-xs capitalize text-zinc-400">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[item.status] }} />
                  {item.status} · {item.count}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
        <h2 className="font-display text-xl font-bold">Top-performing outlets</h2>
        <p className="mt-1 text-sm text-zinc-500">Ranked by redeemed QR codes issued during the selected period.</p>
        <div className="mt-5 overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full min-w-[650px] text-left text-sm" data-testid="analytics-top-outlets">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-zinc-500">
              <tr><th className="p-4">Outlet</th><th className="p-4">City</th><th className="p-4">Issued</th><th className="p-4">Redeemed</th><th className="p-4">Redemption rate</th></tr>
            </thead>
            <tbody>
              {analytics.isLoading ? (
                <tr><td colSpan="5" className="p-8 text-center"><Loader2 className="mx-auto animate-spin text-indigo-300" /></td></tr>
              ) : analytics.data?.top_outlets?.length ? analytics.data.top_outlets.map((outlet) => (
                <tr key={outlet.outlet_id} className="border-b border-white/[0.06] last:border-0">
                  <td className="p-4 font-semibold">{outlet.outlet_name}</td>
                  <td className="p-4 text-zinc-400">{outlet.city || "—"}</td>
                  <td className="p-4">{outlet.issued}</td>
                  <td className="p-4 text-emerald-300">{outlet.redeemed}</td>
                  <td className="p-4">{outlet.redemption_rate}%</td>
                </tr>
              )) : (
                <tr><td colSpan="5" className="p-8 text-center text-zinc-500">No outlet activity was recorded in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
