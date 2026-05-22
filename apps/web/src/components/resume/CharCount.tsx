interface CharCountProps {
  value: string;
  max: number;
}

export function CharCount({ value, max }: CharCountProps) {
  const len = value.length;
  const remaining = max - len;
  const cls =
    remaining < 0
      ? 'text-red-600 text-xs'
      : remaining <= 20
        ? 'text-amber-600 text-xs'
        : 'text-slate-400 text-xs';
  return <span className={cls}>{len}/{max}</span>;
}
