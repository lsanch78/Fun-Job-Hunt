// Shared types for JobLog feature components.
// Lives here (not in the page) so future column-system extraction can share it
// without circular imports.

export interface ColConfig {
  key: string
  visible: boolean
  width: number  // px
}
