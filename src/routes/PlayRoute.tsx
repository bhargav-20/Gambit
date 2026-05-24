import { useEffect, useRef, useState } from 'react';
import { Users, Bot } from 'lucide-react';
import clsx from 'clsx';
import { useGameStore } from '@/core/store/gameStore';
import { usePvpStore } from '@/core/store/pvpStore';
import { useBotStore } from '@/core/store/botStore';
import { useUiStore } from '@/core/store/uiStore';
import { closeCurrent } from '@/features/pvp/session';
import { PvpLobby } from '@/features/pvp/PvpLobby';
import { PvpMatchPanel } from '@/features/pvp/PvpMatchPanel';
import { BotLobby } from '@/features/bot/BotLobby';
import { BotMatchPanel } from '@/features/bot/BotMatchPanel';
import { ActivityLayout } from '@/app/ActivityLayout';

type PlayTab = 'friend' | 'bot';

/**
 * `/play` — the lobby for a live match. Two sub-tabs:
 *
 *   - "Friend"  → PvP over WebRTC. QR handshake → in-game match panel.
 *   - "Bot"     → Local game vs Stockfish at a chosen difficulty.
 *
 * Each lobby owns its own state (pvpStore / botStore). The tab selection
 * is local to this component; when a match is in progress we hide the tabs
 * and show only the board + match panel for that mode.
 */
export function PlayRoute() {
  const channelStatus = usePvpStore((s) => s.channelStatus);
  const localColor = usePvpStore((s) => s.localColor);
  const pvpResult = usePvpStore((s) => s.result);

  const botPlayerColor = useBotStore((s) => s.playerColor);
  const botResult = useBotStore((s) => s.result);
  const mode = useGameStore((s) => s.mode);

  // Default the tab to whichever activity is already in progress, falling
  // back to "friend" — keeps existing PvP users on their familiar surface.
  const [tab, setTab] = useState<PlayTab>(() => (mode === 'play-bot' ? 'bot' : 'friend'));

  useEffect(() => {
    return () => {
      // Route exit — tear down both kinds of in-flight match state.
      closeCurrent();
      const pvp = usePvpStore.getState();
      if (pvp.channelStatus !== 'idle') pvp.reset();
      const bot = useBotStore.getState();
      if (bot.playerColor) bot.reset();
      const m = useGameStore.getState().mode;
      if (m === 'pvp') useGameStore.setState({ mode: 'visualizer', editMode: false });
      if (m === 'play-bot') useGameStore.setState({ mode: 'visualizer', editMode: false });
    };
  }, []);

  // Pop the mobile match drawer when a result fires (PvP only — bot panel
  // sits in the same right column and is desktop-visible; the mobile sheet
  // for bot mode is handled by MobileDrawers when present). Mirrors the
  // existing PvP behavior.
  const prevPvpResult = useRef<typeof pvpResult>(null);
  useEffect(() => {
    if (pvpResult !== null && prevPvpResult.current === null) {
      useUiStore.getState().setMobileSheet('match');
    }
    prevPvpResult.current = pvpResult;
  }, [pvpResult]);

  const prevBotResult = useRef<typeof botResult>(null);
  useEffect(() => {
    if (botResult !== null && prevBotResult.current === null) {
      useUiStore.getState().setMobileSheet('match');
    }
    prevBotResult.current = botResult;
  }, [botResult]);

  const pvpInProgress = (channelStatus === 'connected' || pvpResult !== null) && !!localColor;
  const botInProgress = !!botPlayerColor;

  // If either match is live, render its board. Tabs are hidden — the user
  // ends the match (or leaves the route) before switching opponent types.
  if (pvpInProgress) {
    return <ActivityLayout rightPanel={<PvpMatchPanel />} hidePlayback />;
  }
  if (botInProgress) {
    return <ActivityLayout rightPanel={<BotMatchPanel />} hidePlayback />;
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-bg-raised rounded-xl border border-edge">
        <TabButton active={tab === 'friend'} onClick={() => setTab('friend')} icon={<Users size={13} />} label="Friend" />
        <TabButton active={tab === 'bot'} onClick={() => setTab('bot')} icon={<Bot size={13} />} label="Bot" />
      </div>
      {tab === 'friend' ? <PvpLobby /> : <BotLobby />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-accent/10 text-accent border border-accent/40'
          : 'text-ink-muted hover:text-ink',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
