import { api, ensureAuth } from "../../lib/api";

export const adminApi = {
  settings: async () => {
    await ensureAuth("ADMIN");
    const res = await api.get("/admin/settings");
    return res.data.data;
  },
  updateSettings: async (settingsData: any) => {
    await ensureAuth("ADMIN");
    const res = await api.put("/admin/settings", settingsData);
    return res.data.data;
  },
  analytics: async () => {
    await ensureAuth("ADMIN");
    const res = await api.get("/admin/analytics");
    return res.data.data;
  },
  users: async (page = 1, limit = 10, search?: string) => {
    await ensureAuth("ADMIN");
    const res = await api.get("/admin/users", { params: { page, limit, search } });
    return res.data.data;
  },
  updateUserStatus: async (userId: string, status: "ACTIVE" | "SUSPENDED") => {
    await ensureAuth("ADMIN");
    const res = await api.patch(`/admin/users/${userId}/status`, { status });
    return res.data.data;
  },
  updateUserRole: async (userId: string, role: "USER" | "ADMIN" | "SUPERADMIN") => {
    await ensureAuth("ADMIN");
    const res = await api.patch(`/admin/users/${userId}/role`, { role });
    return res.data.data;
  },
  reports: async () => {
    await ensureAuth("ADMIN");
    const res = await api.get("/admin/reports");
    return res.data.data;
  },
};
