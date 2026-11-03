// Dye palettes are data. Each color keeps the same index (and texture mark)
// across palettes, so swapping dyes never changes how a piece plays.
// unlock.type: "start" | "daily" (distinct daily pieces finished) | "campaign" (levels cleared)
const c = (name, hex, light, dark) => ({ name, hex, light, dark });

export const PALETTES = [
  { id: "madder", name: "Madder & Woad", unlock: { type: "start" }, colors: [
    c("Terracotta", "#C4643C", "#E08A62", "#8E4122"), c("Indigo", "#3D5A80", "#6283AE", "#26384F"),
    c("Moss", "#6B8E5A", "#8FB37C", "#46613A"), c("Saffron", "#D9A441", "#EDC46F", "#A07526"),
    c("Plum", "#7B4B6E", "#A06D93", "#4F2E47")] },
  { id: "seaglass", name: "Sea Glass", unlock: { type: "daily", count: 1 }, colors: [
    c("Coral", "#D9785F", "#EE9C86", "#A4513C"), c("Deep sea", "#2F6475", "#4F8C9E", "#1D4250"),
    c("Kelp", "#5E8C6A", "#82B08E", "#3E6248"), c("Sand", "#D8B46A", "#EBCF92", "#A5843F"),
    c("Mussel", "#5B5878", "#7F7CA0", "#3B3953")] },
  { id: "heather", name: "Highland Heather", unlock: { type: "campaign", count: 3 }, colors: [
    c("Rust", "#A9573A", "#C97A5D", "#783822"), c("Loch", "#405F7A", "#6683A0", "#283E52"),
    c("Bracken", "#7E8A4A", "#A0AC6B", "#57602F"), c("Gorse", "#D3A63A", "#E8C468", "#9C7720"),
    c("Heather", "#8C5E8F", "#AE82B1", "#613D63")] },
  { id: "orchard", name: "Autumn Orchard", unlock: { type: "daily", count: 3 }, colors: [
    c("Apple", "#B8483A", "#D46E60", "#842D23"), c("Slate", "#4C5C70", "#71819A", "#323E4C"),
    c("Pear", "#8EA048", "#AEBF6C", "#65742E"), c("Honey", "#D99A3C", "#EDBB6B", "#A36F22"),
    c("Damson", "#6A3F5E", "#8E6082", "#45283D")] },
  { id: "midnight", name: "Midnight Wool", unlock: { type: "campaign", count: 6 }, colors: [
    c("Ember", "#C8613F", "#E3866A", "#913F25"), c("Night", "#334A73", "#566F9C", "#1F2F4D"),
    c("Pine", "#3E6B57", "#609180", "#284738"), c("Lantern", "#E0B048", "#F0CB78", "#AA8129"),
    c("Fig", "#6E4470", "#936794", "#482B4A")] },
  { id: "festival", name: "Festival Silk", unlock: { type: "campaign", count: 12 }, colors: [
    c("Poppy", "#D3513F", "#EB7868", "#9E3425"), c("Lapis", "#2E5FA3", "#5584C6", "#1D3F70"),
    c("Jade", "#3E8F6E", "#62B391", "#286349"), c("Marigold", "#E6A532", "#F4C566", "#AE7A1B"),
    c("Orchid", "#9A4F95", "#BD74B8", "#6B3367")] }
];

export function isPaletteUnlocked(palette, progress) {
  const u = palette.unlock;
  if (u.type === "start") return true;
  if (u.type === "daily") return progress.dailies.length >= u.count;
  if (u.type === "campaign") return progress.campaign.cleared.length >= u.count;
  return false;
}

export function unlockText(palette) {
  const u = palette.unlock;
  if (u.type === "daily") return `Finish ${u.count} daily ${u.count === 1 ? "piece" : "pieces"}`;
  if (u.type === "campaign") return `Clear ${u.count} campaign ${u.count === 1 ? "level" : "levels"}`;
  return "";
}

export const paletteById = id => PALETTES.find(p => p.id === id) || PALETTES[0];
