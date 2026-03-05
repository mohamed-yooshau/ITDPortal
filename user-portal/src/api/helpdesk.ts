import api from "../api";

export type TicketStatusCount = {
  status: string;
  count: number;
};

export async function fetchTicketStatusCounts(site = "ICT") {
  const response = await api.get(`/helpdesk/status-count?site=${encodeURIComponent(site)}`);
  return response.data?.data ?? response.data;
}
