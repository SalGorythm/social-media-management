export const PLATFORM_LIMITS = {
  instagram: 2200,
  x: 280,
  threads: 500,
  facebook: 63206,
  reddit: 40000,
};

export function platformLabel(platform) {
  switch (platform) {
    case "x":
      return "X";
    case "instagram":
      return "Instagram";
    case "threads":
      return "Threads";
    case "facebook":
      return "Facebook";
    case "reddit":
      return "Reddit";
    default:
      return platform;
  }
}

export function platformIcon(platform) {
  switch (platform) {
    case "instagram":
      return "📷";
    case "x":
      return "𝕏";
    case "threads":
      return "🧵";
    case "facebook":
      return "📘";
    case "reddit":
      return "🤖";
    default:
      return "📱";
  }
}
