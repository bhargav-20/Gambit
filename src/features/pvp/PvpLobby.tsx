import { useEffect, useState } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { usePvpStore, PRESET_TIME_CONTROLS } from '@/core/store/pvpStore';
import type { PvpColor, TimeControl } from '@/core/store/pvpStore';
import { QrDisplay } from './QrDisplay';
import { QrScanner } from './QrScanner';
import { createHostSession, joinSession, closeCurrent } from './session';
import {
  Swords, Wifi, ChevronLeft, ScanLine, QrCode, Loader2, AlertTriangle, Clock, Users,
} from 'lucide-react';
import clsx from 'clsx';

type LobbyStep =
  | 'choose'
  | 'host-setup'
  | 'host-offer'
  | 'host-scan-answer'
  | 'host-applying'
  | 'join-scan-offer'
  | 'join-answer';

/**
 * Lobby for picking a PvP role and walking through the QR handshake. Owns
 * `step` locally — none of this state needs to outlive the panel. Once the
 * data channel reaches 'connected', App renders the in-game match panel
 * instead of this component.
 */
export function PvpLobby() {
  const [step, setStep] = useState<LobbyStep>('choose');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [offerEncoded, setOfferEncoded] = useState<string | null>(null);
  const [answerEncoded, setAnswerEncoded] = useState<string | null>(null);
  const [applyAnswer, setApplyAnswer] = useState<((s: string) => Promise<{ ok: true } | { ok: false; error: string }>) | null>(null);

  const localName = usePvpStore((s) => s.localName);
  const setLocalName = usePvpStore((s) => s.setLocalName);
  const preferredColor = usePvpStore((s) => s.preferredColor);
  const setPreferredColor = usePvpStore((s) => s.setPreferredColor);
  const timeControl = usePvpStore((s) => s.timeControl);
  const setTimeControl = usePvpStore((s) => s.setTimeControl);
  const setLocalColor = usePvpStore((s) => s.setLocalColor);
  const channelStatus = usePvpStore((s) => s.channelStatus);
  const startPvp = useGameStore((s) => s.startPvp);

  // If the channel ever opens we step back to 'choose' so the next reset
  // returns the user to the entry screen.
  useEffect(() => {
    if (channelStatus === 'connected') setStep('choose');
  }, [channelStatus]);

  const cancel = () => {
    closeCurrent();
    setStep('choose');
    setOfferEncoded(null);
    setAnswerEncoded(null);
    setApplyAnswer(null);
    setErrorMsg(null);
  };

  // ---- Host path ----
  const startHostFlow = async () => {
    setErrorMsg(null);
    // Order matters: beginHost() wipes session state to its FRESH defaults
    // (including localColor), so the explicit setLocalColor MUST happen after.
    usePvpStore.getState().beginHost();
    // Resolve random color now so the host knows what to play and the
    // joiner can mirror.
    const resolved: PvpColor =
      preferredColor === 'random'
        ? (Math.random() < 0.5 ? 'white' : 'black')
        : preferredColor;
    setLocalColor(resolved);
    // Seed the game board fresh so the user can already see the starting
    // position while waiting for the joiner.
    startPvp();
    try {
      const res = await createHostSession({
        localName: localName || 'Player',
        hostColor: resolved,
      });
      setOfferEncoded(res.offerEncoded);
      setApplyAnswer(() => res.applyAnswer);
      setStep('host-offer');
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStep('host-setup');
    }
  };

  const onAnswerScanned = async (text: string) => {
    if (!applyAnswer) return;
    setStep('host-applying');
    setErrorMsg(null);
    const res = await applyAnswer(text);
    if (!res.ok) {
      setErrorMsg(res.error);
      setStep('host-scan-answer');
    }
    // On success the channel.onopen handler in session.ts will set channelStatus='connected',
    // and our effect above kicks the panel back to 'choose' (but the in-game UI is now showing).
  };

  // ---- Joiner path ----
  const onOfferScanned = async (text: string) => {
    setErrorMsg(null);
    const res = await joinSession({ localName: localName || 'Player', offerEncoded: text });
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    // joinSession sets pvpStore.localColor based on the host's color choice,
    // and sets the time control. Seed the board to match.
    startPvp();
    setAnswerEncoded(res.handshake.answerEncoded);
    setStep('join-answer');
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        {step !== 'choose' ? (
          <button className="btn-ghost text-xs gap-1 -ml-2" onClick={cancel}>
            <ChevronLeft size={14} /> Back
          </button>
        ) : (
          <Swords size={16} className="text-accent" />
        )}
        <h2 className="font-display text-lg">Play a friend</h2>
        <span className="chip ml-auto">
          <Wifi size={11} /> Same WiFi
        </span>
      </div>

      {errorMsg && (
        <div className="panel-tight p-3 text-xs text-bad flex items-start gap-2 border-bad/40 bg-bad/5">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {step === 'choose' && (
        <ChooseStep
          localName={localName}
          onName={setLocalName}
          onHost={() => setStep('host-setup')}
          onJoin={() => setStep('join-scan-offer')}
        />
      )}

      {step === 'host-setup' && (
        <HostSetupStep
          preferredColor={preferredColor}
          onColor={setPreferredColor}
          timeControl={timeControl}
          onTimeControl={setTimeControl}
          onContinue={startHostFlow}
        />
      )}

      {step === 'host-offer' && offerEncoded && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-muted text-center px-2">
            <strong className="text-ink">Step 1 of 2.</strong> Your friend scans this QR to join.
          </p>
          <QrDisplay value={offerEncoded} />
          <button className="btn-primary" onClick={() => setStep('host-scan-answer')}>
            <ScanLine size={14} /> They scanned — show me their QR
          </button>
        </div>
      )}

      {step === 'host-scan-answer' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-muted text-center px-2">
            <strong className="text-ink">Step 2 of 2.</strong> Scan the QR they're now showing.
          </p>
          <QrScanner onResult={onAnswerScanned} hint="Point camera at your friend's QR" />
        </div>
      )}

      {step === 'host-applying' && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-ink-muted">
          <Loader2 size={20} className="animate-spin text-accent" />
          <p className="text-xs">Connecting over LAN…</p>
        </div>
      )}

      {step === 'join-scan-offer' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-muted text-center px-2">
            <strong className="text-ink">Step 1 of 2.</strong> Scan your friend's QR.
          </p>
          <QrScanner onResult={onOfferScanned} hint="Point camera at the host's screen" />
        </div>
      )}

      {step === 'join-answer' && answerEncoded && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-muted text-center px-2">
            <strong className="text-ink">Step 2 of 2.</strong> Show this QR back to the host.
          </p>
          <QrDisplay value={answerEncoded} />
          <div className="flex items-center justify-center gap-2 text-xs text-ink-muted">
            <Loader2 size={12} className="animate-spin" /> Waiting for host to scan…
          </div>
        </div>
      )}
    </div>
  );
}

function ChooseStep({
  localName,
  onName,
  onHost,
  onJoin,
}: {
  localName: string;
  onName: (v: string) => void;
  onHost: () => void;
  onJoin: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Two devices on the same WiFi. No accounts, no servers — just scan a QR.
      </p>
      <div>
        <label className="label">Your name</label>
        <input
          className="input mt-1.5"
          value={localName}
          onChange={(e) => onName(e.target.value)}
          placeholder="Player"
          maxLength={20}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary py-4 flex-col gap-1" onClick={onHost}>
          <QrCode size={18} />
          <span className="text-sm">Host a game</span>
        </button>
        <button className="btn py-4 flex-col gap-1" onClick={onJoin}>
          <ScanLine size={18} />
          <span className="text-sm">Join a game</span>
        </button>
      </div>
      <div className="text-xs text-ink-faint flex items-start gap-2 px-1">
        <Users size={12} className="shrink-0 mt-0.5" />
        <span>The host picks color and time control. The joiner just scans.</span>
      </div>
    </div>
  );
}

function HostSetupStep({
  preferredColor,
  onColor,
  timeControl,
  onTimeControl,
  onContinue,
}: {
  preferredColor: PvpColor | 'random';
  onColor: (c: PvpColor | 'random') => void;
  timeControl: TimeControl;
  onTimeControl: (tc: TimeControl) => void;
  onContinue: () => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customMin, setCustomMin] = useState(Math.round(timeControl.baseMs / 60_000));
  const [customInc, setCustomInc] = useState(Math.round(timeControl.incMs / 1000));

  const activePreset = PRESET_TIME_CONTROLS.find(
    (p) => p.tc.baseMs === timeControl.baseMs && p.tc.incMs === timeControl.incMs,
  );

  const applyCustom = () => {
    const base = Math.max(1, Math.min(180, customMin)) * 60_000;
    const inc = Math.max(0, Math.min(60, customInc)) * 1_000;
    onTimeControl({ baseMs: base, incMs: inc });
    setShowCustom(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="label">Play as</label>
        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
          <ColorChip label="White" active={preferredColor === 'white'} onClick={() => onColor('white')} />
          <ColorChip label="Random" active={preferredColor === 'random'} onClick={() => onColor('random')} />
          <ColorChip label="Black" active={preferredColor === 'black'} onClick={() => onColor('black')} />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Clock size={11} className="text-ink-muted" />
          <label className="label">Time control</label>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESET_TIME_CONTROLS.map((p) => (
            <button
              key={p.id}
              onClick={() => { onTimeControl(p.tc); setShowCustom(false); }}
              className={clsx(
                'rounded-lg border px-3 py-2 text-xs text-left transition-colors',
                activePreset?.id === p.id && !showCustom
                  ? 'border-accent/60 bg-accent/10 text-accent'
                  : 'border-edge bg-bg-raised hover:border-edge-strong text-ink',
              )}
            >
              <div className="font-medium font-mono">{p.id}</div>
              <div className="text-[10px] text-ink-faint mt-0.5">{p.label.split('—')[1]?.trim()}</div>
            </button>
          ))}
          <button
            onClick={() => setShowCustom((v) => !v)}
            className={clsx(
              'rounded-lg border px-3 py-2 text-xs text-left transition-colors col-span-2',
              showCustom
                ? 'border-accent/60 bg-accent/10 text-accent'
                : 'border-edge bg-bg-raised hover:border-edge-strong text-ink',
            )}
          >
            {showCustom ? 'Custom…' : (activePreset ? 'Custom…' : `Custom ${Math.round(timeControl.baseMs / 60_000)}+${Math.round(timeControl.incMs / 1000)}`)}
          </button>
        </div>
        {showCustom && (
          <div className="mt-2 flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-ink-muted uppercase tracking-wider">Minutes</label>
              <input
                type="number"
                min={1}
                max={180}
                value={customMin}
                onChange={(e) => setCustomMin(Number(e.target.value))}
                className="input mt-1 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-ink-muted uppercase tracking-wider">Increment (s)</label>
              <input
                type="number"
                min={0}
                max={60}
                value={customInc}
                onChange={(e) => setCustomInc(Number(e.target.value))}
                className="input mt-1 text-sm"
              />
            </div>
            <button className="btn text-xs" onClick={applyCustom}>Apply</button>
          </div>
        )}
      </div>

      <button className="btn-primary mt-2" onClick={onContinue}>
        <QrCode size={14} /> Show invite QR
      </button>
    </div>
  );
}

function ColorChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-lg border px-2 py-1.5 text-xs transition-colors',
        active
          ? 'border-accent/60 bg-accent/10 text-accent'
          : 'border-edge bg-bg-raised hover:border-edge-strong text-ink',
      )}
    >
      {label}
    </button>
  );
}
