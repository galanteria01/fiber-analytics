import { Button } from '@/components/ui/button';
import type { Filters } from '@/lib/filters';
import type { FilterOptions } from '@/lib/queries';

const inputClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground';

function Select({
  name,
  value,
  placeholder,
  options,
}: {
  name: string;
  value?: string;
  placeholder: string;
  options: string[];
}) {
  return (
    <select name={name} defaultValue={value ?? ''} className={inputClass}>
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

/**
 * Server-rendered global filter bar. Uses a plain GET form so filtering needs
 * no client JS: the page re-renders server-side with the new search params,
 * which flow into queries as bound parameters.
 */
export function FilterBar({
  action,
  filters,
  options,
}: {
  action: string;
  filters: Filters;
  options: FilterOptions;
}) {
  return (
    <form
      method="get"
      action={action}
      className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3"
    >
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        From
        <input type="date" name="from" defaultValue={filters.from?.slice(0, 10)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        To
        <input type="date" name="to" defaultValue={filters.to?.slice(0, 10)} className={inputClass} />
      </label>
      <Select name="domain" value={filters.domain} placeholder="All domains" options={options.domains} />
      <Select name="type" value={filters.eventType} placeholder="All types" options={options.eventTypes} />
      <Select
        name="component"
        value={filters.component}
        placeholder="All components"
        options={options.components}
      />
      <input
        type="text"
        name="url"
        placeholder="URL contains…"
        defaultValue={filters.url}
        className={`${inputClass} w-40`}
      />
      <Button type="submit" size="sm">
        Apply
      </Button>
      <Button asChild variant="ghost" size="sm">
        <a href={action}>Reset</a>
      </Button>
    </form>
  );
}
