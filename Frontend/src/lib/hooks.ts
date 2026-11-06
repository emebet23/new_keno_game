import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { walletApi, gameApi } from "./api";
import { useAppStore } from "./store";

export {
  useAdminSettings,
  useUpdateAdminSettings,
  useAdminAnalytics,
  useAdminUsers,
  useUpdateUserStatus,
  useUpdateUserRole,
  useAdminReports,
} from "../features/admin/hooks";

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: walletApi.get,
    staleTime: 3000,
    retry: 2,
  });
}

export function useDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, reference }: { amount: number; reference?: string }) =>
      walletApi.deposit(amount, reference),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet"] }),
  });
}

export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, reference }: { amount: number; reference?: string }) =>
      walletApi.withdraw(amount, reference),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet"] }),
  });
}

export function useTransactions(page = 1, limit = 10) {
  return useQuery({
    queryKey: ["transactions", page, limit],
    queryFn: () => walletApi.transactions(page, limit),
  });
}

export function useCurrentRound() {
  return useQuery({
    queryKey: ["currentRound"],
    queryFn: gameApi.current,
    staleTime: 5000,
  });
}

export function usePlayKeno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      selectedNumbers,
      betAmount,
      mode,
    }: {
      selectedNumbers: number[];
      betAmount: number;
      mode?: "INSTANT" | "CLASSIC";
    }) => {
      const clientSeed = useAppStore.getState().clientSeed;
      return gameApi.play(selectedNumbers, betAmount, mode, clientSeed);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["currentRound"] });
    },
  });
}

export function useQuickPick() {
  return useMutation({
    mutationFn: (count: number) => gameApi.quickPick(count),
  });
}

export function useHistory(page = 1, limit = 10) {
  return useQuery({
    queryKey: ["history", page, limit],
    queryFn: () => gameApi.history(page, limit),
  });
}

export function useSettledGames() {
  return useQuery({
    queryKey: ["settledGames"],
    queryFn: gameApi.settledGames,
    refetchInterval: 30000,
  });
}

export function useProvablyFair(gameId?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["provablyFair", gameId],
    queryFn: () => gameApi.provablyFair(gameId),
    enabled: opts?.enabled ?? true,
  });
}

export function useVerify() {
  return useMutation({
    mutationFn: ({
      serverSeed,
      clientSeed,
      nonce,
    }: {
      serverSeed: string;
      clientSeed: string;
      nonce: number;
    }) => gameApi.verify(serverSeed, clientSeed, nonce),
  });
}


