/** A subtle placeholder for a table/detail cell with no data — deliberately
 * recedes (lighter than muted-foreground) instead of reading as a wall of
 * broken-looking dashes when several columns are unpopulated at once. Never
 * fabricates a value; just makes "we don't have this" look intentional. */
export function EmptyCell() {
  return (
    <span className="text-muted-foreground/40" aria-label="Not available">
      –
    </span>
  );
}
