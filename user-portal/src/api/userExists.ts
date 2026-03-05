import api from "../api";

export async function fetchUserExists(): Promise<boolean> {
  try {
    const res = await api.get("/users/me/exists");
    return Boolean(res.data?.exists);
  } catch {
    return true;
  }
}
