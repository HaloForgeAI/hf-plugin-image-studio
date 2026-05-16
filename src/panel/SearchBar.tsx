import { Search, Star } from "lucide-react";
import type { TaskStatusFilter } from "../types";

interface SearchBarProps {
  searchQuery: string;
  filterStatus: TaskStatusFilter;
  filterFavorite: boolean;
  onSearchQueryChange: (value: string) => void;
  onFilterStatusChange: (value: TaskStatusFilter) => void;
  onFilterFavoriteChange: (value: boolean) => void;
}

export function SearchBar({
  searchQuery,
  filterStatus,
  filterFavorite,
  onSearchQueryChange,
  onFilterStatusChange,
  onFilterFavoriteChange,
}: SearchBarProps) {
  return (
    <section className="hfis-search" data-no-drag-select>
      <button
        type="button"
        className={`hfis-fav-filter ${filterFavorite ? "is-active" : ""}`}
        onClick={() => onFilterFavoriteChange(!filterFavorite)}
        title={filterFavorite ? "Show all tasks" : "Favorites only"}
      >
        <Star size={18} fill={filterFavorite ? "currentColor" : "none"} />
      </button>
      <select
        value={filterStatus}
        onChange={(event) => onFilterStatusChange(event.target.value as TaskStatusFilter)}
        title="Filter status"
      >
        <option value="all">All status</option>
        <option value="done">Done</option>
        <option value="running">Running</option>
        <option value="error">Error</option>
      </select>
      <label className="hfis-search-input">
        <Search size={16} />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search prompt or parameters..."
        />
      </label>
    </section>
  );
}
