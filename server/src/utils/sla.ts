import { Priority } from "@prisma/client";
import { config } from "../config";

export function calculateSlaDeadline(priority: Priority): Date {
  const hours = config.slaHours[priority];
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hours);
  return deadline;
}
