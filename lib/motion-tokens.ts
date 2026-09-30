export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.18,
    normal: 0.35,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1] as const,
    sharp: [0.4, 0, 0.2, 1] as const,
  },
  distance: {
    xs: 4,
    sm: 8,
  },
} as const;

export const springs = {
  snappy: { type: "spring" as const, stiffness: 300, damping: 30 },
  bookReveal: { type: "spring" as const, stiffness: 240, damping: 29, mass: 0.9 },
} as const;
