// Shape + spacing primitives. 8px grid, 16px card radius.

export const shape = { borderRadius: 12 };

// Named radii for components that want a value other than the base card radius.
export const radii = {
  card: 16,
  button: 10,
  chip: 999,
  input: 10,
  dialog: 20,
  sidebar: 12,
};

// MUI multiplies spacing(n) by 8 → 8px grid system.
export const spacingUnit = 8;
