// Shape + spacing primitives. 8px grid, 12px card radius.

export const shape = { borderRadius: 12 };

// Named radii for components that want a value other than the base card radius.
export const radii = {
  card: 12,
  button: 8,
  chip: 999,
  input: 8,
};

// MUI multiplies spacing(n) by 8 → 8px grid system.
export const spacingUnit = 8;
