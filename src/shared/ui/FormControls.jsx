export function TextInput(props) {
  return <input type="text" {...props} />;
}

// step/min van después del spread: EditModal pasa step={undefined} y, si pisa el valor por defecto,
// el navegador usa step=1 y rechaza montos con centavos distintos a los originales.
export function NumberInput({ step, min, ...props }) {
  return <input type="number" step={step ?? '0.01'} min={min ?? '0'} {...props} />;
}

export function DateInput(props) {
  return <input type="date" {...props} />;
}

export function Select({ children, ...props }) {
  return <select {...props}>{children}</select>;
}
