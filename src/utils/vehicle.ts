const RESET = "\u001B[0m";

const VEHICLE_FALLBACK_COLORS: Record<string, { bg: string; fg: string }> = {
  BUS: { bg: "#2E7D32", fg: "#FFFFFF" },
  INTERCITY_BUS: { bg: "#2E7D32", fg: "#FFFFFF" },
  COMMUTER_TRAIN: { bg: "#1A1A1A", fg: "#FFFFFF" },
  HEAVY_RAIL: { bg: "#1A1A1A", fg: "#FFFFFF" },
  LONG_DISTANCE_TRAIN: { bg: "#1A1A1A", fg: "#FFFFFF" },
  RAIL: { bg: "#1A1A1A", fg: "#FFFFFF" },
  HIGH_SPEED_TRAIN: { bg: "#1565C0", fg: "#FFFFFF" },
  METRO_RAIL: { bg: "#0055A4", fg: "#FFFFFF" },
  SUBWAY: { bg: "#0055A4", fg: "#FFFFFF" },
  TRAM: { bg: "#C62828", fg: "#FFFFFF" },
  TROLLEYBUS: { bg: "#C62828", fg: "#FFFFFF" },
  MONORAIL: { bg: "#1565C0", fg: "#FFFFFF" },
  SHARE_TAXI: { bg: "#F9A825", fg: "#000000" },
};

const VEHICLE_LABELS: Record<string, string> = {
  BUS: "BUS",
  COMMUTER_TRAIN: "TRAIN",
  HEAVY_RAIL: "RAIL",
  HIGH_SPEED_TRAIN: "HSR",
  INTERCITY_BUS: "BUS",
  LONG_DISTANCE_TRAIN: "TRAIN",
  METRO_RAIL: "METRO",
  MONORAIL: "MONO",
  RAIL: "RAIL",
  SHARE_TAXI: "TAXI",
  SUBWAY: "SUB",
  TRAM: "TRAM",
  TROLLEYBUS: "TROLLEY",
};

function supportsAnsiColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, "");

  if (!/^[A-Fa-f0-9]{6}$/.test(clean)) {
    return null;
  }

  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function foreground(rgb: { r: number; g: number; b: number }): string {
  return `\u001B[38;2;${rgb.r};${rgb.g};${rgb.b}m`;
}

function background(rgb: { r: number; g: number; b: number }): string {
  return `\u001B[48;2;${rgb.r};${rgb.g};${rgb.b}m`;
}

export function colorizeForeground(text: string, hex?: string): string {
  if (!hex || !supportsAnsiColor()) {
    return text;
  }

  const rgb = hexToRgb(hex);
  if (!rgb) {
    return text;
  }

  return `${foreground(rgb)}${text}${RESET}`;
}

export function colorizeBadge(
  text: string,
  options?: { backgroundColor?: string; textColor?: string },
): string {
  if (!options || !supportsAnsiColor()) {
    return text;
  }

  const bg = options.backgroundColor ? hexToRgb(options.backgroundColor) : null;
  const fg = options.textColor ? hexToRgb(options.textColor) : null;

  if (!bg && !fg) {
    return text;
  }

  const start = `${fg ? foreground(fg) : ""}${bg ? background(bg) : ""}`;
  return `${start}${text}${RESET}`;
}

export function vehicleFallbackColors(
  vehicleType?: string,
): { bg: string; fg: string } | undefined {
  if (!vehicleType) {
    return undefined;
  }
  return VEHICLE_FALLBACK_COLORS[vehicleType];
}

export function vehicleLabel(vehicleType?: string): string {
  if (!vehicleType) {
    return "TRANSIT";
  }

  return VEHICLE_LABELS[vehicleType] ?? vehicleType;
}
