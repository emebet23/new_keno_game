import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "./api";

export function useAdminSettings() {
  return useQuery({
    queryKey: ["adminSettings"],
    queryFn: adminApi.settings,
  });
}

export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApi.updateSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminSettings"] }),
  });
}

export function useAdminAnalytics() {
  return useQuery({
    queryKey: ["adminAnalytics"],
    queryFn: adminApi.analytics,
  });
}

export function useAdminUsers(page = 1, limit = 10, search?: string) {
  return useQuery({
    queryKey: ["adminUsers", page, limit, search],
    queryFn: () => adminApi.users(page, limit, search),
  });
}

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "ACTIVE" | "SUSPENDED" }) =>
      adminApi.updateUserStatus(userId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminUsers"] }),
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "USER" | "ADMIN" | "SUPERADMIN" }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminUsers"] }),
  });
}

export function useAdminReports() {
  return useQuery({
    queryKey: ["adminReports"],
    queryFn: adminApi.reports,
  });
}
