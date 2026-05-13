export interface Session {
  id: string;
  type: "planning" | "implementing" | "addressing-review";
  timestamp: string; // ISO 8601
  status: "success" | "failure";
}
