import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Key, Server, RefreshCw } from 'lucide-react';

interface AnalyticsData {
  totalAttempts: number;
  successes: number;
  failures: number;
  successRate: number;
  byEngine: { engine: string; count: string }[];
  byKey: { api_key_used: string; count: string; successes: string }[];
  recentLogs: {
    id: string;
    engine: string;
    api_key_used: string;
    status: string;
    error_message: string | null;
    created_at: string;
  }[];
}

export default function AdminDashboard() {
  const [secret, setSecret] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async (adminSecret: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/analytics', {
        headers: {
          'x-admin-secret': adminSecret
        }
      });
      
      if (!res.ok) {
        throw new Error(res.status === 403 ? 'Invalid admin secret' : 'Failed to fetch analytics');
      }
      
      const json = await res.json();
      setData(json);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalytics(secret);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <Activity className="w-8 h-8 text-indigo-400" />
            <h1 className="text-2xl font-semibold">TEKDEV Admin</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-white/50 mb-2">Admin Secret</label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Enter secret key..."
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || !secret}
              className="w-full bg-white text-black font-medium py-3 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-400" />
            <h1 className="text-3xl font-semibold">Fazion Analytics</h1>
          </div>
          <button
            onClick={() => fetchAnalytics(secret)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </button>
        </div>

        {data && (
          <>
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                <p className="text-white/50 text-sm font-medium mb-2">Total Requests</p>
                <p className="text-4xl font-light">{data.totalAttempts}</p>
              </div>
              <div className="bg-white/[0.03] border border-emerald-500/20 rounded-2xl p-6">
                <p className="text-emerald-400/70 text-sm font-medium mb-2">Successes</p>
                <p className="text-4xl font-light text-emerald-400">{data.successes}</p>
              </div>
              <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-6">
                <p className="text-red-400/70 text-sm font-medium mb-2">Failures</p>
                <p className="text-4xl font-light text-red-400">{data.failures}</p>
              </div>
              <div className="bg-white/[0.03] border border-indigo-500/20 rounded-2xl p-6">
                <p className="text-indigo-400/70 text-sm font-medium mb-2">Success Rate</p>
                <p className="text-4xl font-light text-indigo-400">{data.successRate.toFixed(1)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Engine Stats */}
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Server className="w-5 h-5 text-white/50" />
                  <h2 className="text-lg font-medium">Usage by Engine</h2>
                </div>
                <div className="space-y-4">
                  {data.byEngine.map(stat => (
                    <div key={stat.engine} className="flex items-center justify-between p-4 bg-black/20 rounded-xl">
                      <span className="capitalize">{stat.engine}</span>
                      <span className="font-mono text-white/70">{stat.count} requests</span>
                    </div>
                  ))}
                  {data.byEngine.length === 0 && <p className="text-white/40 text-sm">No data yet.</p>}
                </div>
              </div>

              {/* API Key Stats */}
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Key className="w-5 h-5 text-white/50" />
                  <h2 className="text-lg font-medium">API Key Performance</h2>
                </div>
                <div className="space-y-4">
                  {data.byKey.map(stat => {
                    const rate = parseInt(stat.count) > 0 ? (parseInt(stat.successes) / parseInt(stat.count)) * 100 : 0;
                    return (
                      <div key={stat.api_key_used} className="flex items-center justify-between p-4 bg-black/20 rounded-xl">
                        <span className="font-mono text-sm">{stat.api_key_used}</span>
                        <div className="text-right">
                          <p className="text-sm font-medium">{stat.count} uses</p>
                          <p className={rate < 90 ? "text-red-400 text-xs" : "text-emerald-400 text-xs"}>
                            {rate.toFixed(1)}% success
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {data.byKey.length === 0 && <p className="text-white/40 text-sm">No data yet.</p>}
                </div>
              </div>
            </div>

            {/* Recent Logs */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 overflow-hidden">
              <h2 className="text-lg font-medium mb-6">Recent Generation Logs</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-white/50 border-b border-white/10">
                    <tr>
                      <th className="pb-3 font-medium">Time</th>
                      <th className="pb-3 font-medium">Engine</th>
                      <th className="pb-3 font-medium">API Key</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.recentLogs.map(log => (
                      <tr key={log.id} className="text-white/80">
                        <td className="py-3 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="py-3 capitalize">{log.engine}</td>
                        <td className="py-3 font-mono text-xs">{log.api_key_used}</td>
                        <td className="py-3">
                          {log.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md text-xs">
                              <CheckCircle className="w-3 h-3" /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-400 bg-red-400/10 px-2 py-1 rounded-md text-xs">
                              <XCircle className="w-3 h-3" /> Failed
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-xs text-red-300 max-w-xs truncate" title={log.error_message || ''}>
                          {log.error_message || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.recentLogs.length === 0 && (
                  <div className="text-center py-8 text-white/40">No logs recorded yet.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
