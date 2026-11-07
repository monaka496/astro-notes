const carrierButtonColors: Record<string, string> = {
  "ドコモ": "#cc0033",
  "docomo": "#cc0033",
  "au": "#ea5504",
  "softbank": "#111111",
  "ソフトバンク": "#111111",
  "楽天": "#bf0000",
  "rakuten": "#bf0000",
  "ahamo": "#222222",
  "povo": "#00a6a0",
  "ymobile": "#e6007e",
  "ワイモバイル": "#e6007e",
  "linemo": "#00a0e9",
};

export const getCtaButtonColor = (styles?: string[]) => {
  const selected = styles?.find((style) => carrierButtonColors[style.toLowerCase()] || carrierButtonColors[style]);
  return selected ? carrierButtonColors[selected.toLowerCase()] || carrierButtonColors[selected] : "#1d4ed8";
};
