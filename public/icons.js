const shapes = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
  box: '<path d="m12 3 9 5v10l-9 5-9-5V8l9-5Zm0 10v10M3 8l9 5 9-5M7 5.8l10 5.5"/>',
  users:
    '<circle cx="9" cy="8" r="4"/><path d="M2 22v-4c0-6 14-6 14 0v4m0-19c6 0 6 9 1 9m2 3c3 1 3 4 3 7"/>',
  bag: '<rect x="4" y="6" width="16" height="17" rx="4"/><path d="M8 6V4a4 4 0 0 1 8 0v2M7 15h10v5H7zM9 10h6"/>',
  phone:
    '<rect x="6" y="1" width="12" height="22" rx="2.5"/><path d="M10 4h4m-4 16h4"/>',
  headphones:
    '<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 11H1v9h5v-9H3Zm18 0h2v9h-5v-9h3Z"/>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2"/><circle cx="7" cy="11" r="2"/><path d="M4 17v-1c0-3 6-3 6 0v1m3-8h7m-7 4h5"/>',
  key: '<circle cx="7" cy="7" r="5"/><path d="m11 11 11 11m-3-3 3-3m-6 0 3-3"/>',
  book: '<path d="M3 2h15a2 2 0 0 1 2 2v18H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm0 16h17M7 2v16m4-11h5m-5 4h5"/>',
  shirt: '<path d="m7 2 5 3 5-3 6 7-4 4-2-2v12H7V11l-2 2-4-4 6-7Z"/>',
  bottle:
    '<path d="M9 1h6v4l3 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10l3-5V1Zm-3 11h12M9 5h6"/>',
  glasses:
    '<circle cx="6" cy="15" r="5"/><circle cx="18" cy="15" r="5"/><path d="M11 14h2M1 14 3 4h3m17 10L21 4h-3"/>',
  wallet:
    '<rect x="2" y="5" width="21" height="16" rx="3"/><path d="M2 7V4a2 2 0 0 1 2-2h15v3m-2 7h6v5h-6a2.5 2.5 0 0 1 0-5Z"/>',
  shield:
    '<path d="m12 2 9 4v6c0 7-9 11-9 11S3 19 3 12V6l9-4Z"/><path d="m7 12 3 3 7-7"/>',
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.box}</svg>`;
export function itemIcon(item) {
  const n = item.name.toLowerCase();
  if (n.includes("headphone")) return "headphones";
  if (n.includes("bottle")) return "bottle";
  if (n.includes("glasses")) return "glasses";
  if (n.includes("wallet")) return "wallet";
  return (
    {
      Electronics: "phone",
      Bags: "bag",
      "Cards & IDs": "card",
      Keys: "key",
      Books: "book",
      Clothing: "shirt",
    }[item.category] || "box"
  );
}
