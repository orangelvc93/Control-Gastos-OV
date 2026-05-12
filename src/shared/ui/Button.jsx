export function Button({ children, className = '', variant = 'primary', ...props }) {
  const variantClass = variant === 'secondary' ? 'secondary' : '';
  const classes = ['ghost-button', variantClass, className].filter(Boolean).join(' ');

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({ children, className = '', ...props }) {
  const classes = ['link-button', className].filter(Boolean).join(' ');

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
