export function Card({ as: Component = 'article', children, className = '', ...props }) {
  const classes = ['ledger-card', className].filter(Boolean).join(' ');

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
