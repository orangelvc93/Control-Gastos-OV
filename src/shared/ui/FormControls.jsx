export function TextInput(props) {
  return <input type="text" {...props} />;
}

export function NumberInput(props) {
  return <input type="number" step="0.01" min="0" {...props} />;
}

export function DateInput(props) {
  return <input type="date" {...props} />;
}

export function Select({ children, ...props }) {
  return <select {...props}>{children}</select>;
}
