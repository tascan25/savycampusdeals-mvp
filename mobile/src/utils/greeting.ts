const SALUTATIONS = ["Hey", "Hello", "Hola", "Hi"] as const;

export function getTimeGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function getRotatingSalutation(date: Date): string {
  const fiveMinuteWindow = Math.floor(date.getTime() / 300_000);
  return SALUTATIONS[fiveMinuteWindow % SALUTATIONS.length] ?? "Hey";
}
