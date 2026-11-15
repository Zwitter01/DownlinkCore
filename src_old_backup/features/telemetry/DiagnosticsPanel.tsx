import { useTelemetryStore } from '../../stores/telemetryStore';
import { Terminal, AlertCircle, Package } from 'lucide-react';
import { format } from 'date-fns';

export function DiagnosticsPanel() {
  const diag = useTelemetryStore(s => s.diagnostics);

  return (
    <div className="liquid-glass-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
        <Terminal size={14} className="text-[#c026d3]" />
        <h3 className="text-sm font-semibold text-white">Diagnostics</h3>
        <div className="ml-auto flex items-center gap-3 text-xs font-mono text-white/50">
          <span className="flex items-center gap-1"><Package size={11} className="text-[#7c3aed]" />{diag.received.toLocaleString()} recv</span>
          {diag.invalid > 0 && <span className="flex items-center gap-1 text-[#FF453A]"><AlertCircle size={11} />{diag.invalid} invalid</span>}
          {diag.missedCount > 0 && <span className="text-[#f59e0b]">{diag.missedCount} missed pkts</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Last raw packet */}
        <div className="p-4 border-b md:border-b-0 md:border-r border-white/[0.06]">
          <p className="text-xs text-[#c026d3]/80 mb-2 font-semibold uppercase tracking-wider">Last Raw JSON Packet</p>
          {diag.lastRawJson ? (
            <pre className="text-xs text-[#c026d3] bg-black/80 border border-[#7c3aed]/25 rounded-xl p-3 font-mono leading-relaxed overflow-x-auto shadow-inner">
              {(() => { try { return JSON.stringify(JSON.parse(diag.lastRawJson), null, 2); } catch { return diag.lastRawJson; } })()}
            </pre>
          ) : (
            <p className="text-white/40 text-xs italic">No packets received yet</p>
          )}
        </div>

        {/* Validation errors + connection events */}
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-white/50 mb-2 font-semibold uppercase tracking-wider">Validation Errors (last 20)</p>
            {diag.validationErrors.length === 0 ? (
              <p className="text-[#30D158] text-xs font-mono">No errors</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {diag.validationErrors.slice(0, 20).map((e, i) => (
                  <p key={i} className="text-xs text-[#FF453A]/90 font-mono">{e}</p>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-white/50 mb-2 font-semibold uppercase tracking-wider">Connection Events</p>
            {diag.connectionEvents.length === 0 ? (
              <p className="text-white/40 text-xs italic">None yet</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {diag.connectionEvents.slice(0, 15).map((ev, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      ev.type === 'connected' ? 'bg-[#c026d3] shadow-[0_0_6px_#c026d3]'
                      : ev.type === 'error' ? 'bg-[#FF453A]'
                      : ev.type === 'disconnected' ? 'bg-[#FF453A]/80'
                      : 'bg-[#7c3aed]'
                    }`} />
                    <span className="text-white/40 font-mono text-[11px]">{format(new Date(ev.at), 'HH:mm:ss')}</span>
                    <span className="text-white/70 capitalize font-medium">{ev.type}</span>
                    {ev.detail && <span className="text-white/30 truncate text-xs">{ev.detail}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
