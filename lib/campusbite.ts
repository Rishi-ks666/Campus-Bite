export const CURRENT_STUDENT_ID = "S001";

export function formatSlot(slotTime: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/.exec(slotTime);
  if (!match) throw new Error(`Invalid pickup time: ${slotTime}`);

  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "am" : "pm"}`;
}
