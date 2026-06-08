import { NavLink } from 'react-router-dom'

export default function CV() {
  return (
    <NavLink
      to="/cv"
      className={({ isActive }) =>
        `border px-3 py-1.5 text-[10px] tracking-widest transition-none ${
          isActive
            ? 'border-primary text-primary'
            : 'border-border text-muted hover:border-secondary hover:text-secondary'
        }`
      }
    >
      CV
    </NavLink>
  )
}
