import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSocket, SOCKET_EVENTS, type LiveSettledEvent, type WalletUpdatedEvent, type DrawNumbersEvent, type GameStartedEvent } from "../lib/socket";
import { useAppStore } from "../lib/store";

// Persistent, invisible socket layer. Stays mounted so wallet / history stay in
// sync and the classic countdown knows when a draw is live, no matter which tab
// is open. The inline reveal strip (LiveReveal) only renders the animation.
export default function LiveSocket() {
  const setPendingClassic = useAppStore((s) => s.setPendingClassic);
  const setClassicDrawing = useAppStore((s) => s.setClassicDrawing);
  const setLiveSettled = useAppStore((s) => s.setLiveSettled);
  const qc = useQueryClient();
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);

  useEffect(() => {
    if (socketRef.current) return;

    const socket = createSocket();
    socketRef.current = socket;

    socket.on(SOCKET_EVENTS.GAME_STARTED, (_payload: GameStartedEvent) => {
      setClassicDrawing(true);
    });

    socket.on(SOCKET_EVENTS.DRAW_NUMBERS, (_payload: DrawNumbersEvent) => {
      setClassicDrawing(false);
    });

    socket.on(SOCKET_EVENTS.GAME_SETTLED, (payload: LiveSettledEvent) => {
      setClassicDrawing(false);
      setLiveSettled(payload);
      setPendingClassic(null);
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["settledGames"] });
    });

    socket.on(SOCKET_EVENTS.WALLET_UPDATED, (_payload: WalletUpdatedEvent) => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
    });

    // Wait for auth to be ready before connecting.
    const tryConnect = () => {
      if (localStorage.getItem("keno_token") && !socket.connected) {
        socket.connect();
      }
    };
    tryConnect();
    const authPoll = setInterval(() => {
      const hasToken = !!localStorage.getItem("keno_token");
      if (hasToken && !socket.connected) {
        socket.connect();
      } else if (!hasToken && socket.connected) {
        socket.disconnect();
      }
    }, 1500);

    return () => {
      clearInterval(authPoll);
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
