import { AppSelect } from "@haloforge/plugin-sdk";
import { Search, Star, X } from "lucide-react";
import { useState } from "react";
import type { ImageStudioT } from "../i18n";
import type { TaskStatusFilter } from "../types";

interface SearchBarProps {
  t: ImageStudioT;
  searchQuery: string;
  filterStatus: TaskStatusFilter;
  filterFavorite: boolean;
  onSearchQueryChange: (value: string) => void;
  onFilterStatusChange: (value: TaskStatusFilter) => void;
  onFilterFavoriteChange: (value: boolean) => void;
}

export function SearchBar({
  t,
  searchQuery,
  filterStatus,
  filterFavorite,
  onSearchQueryChange,
  onFilterStatusChange,
  onFilterFavoriteChange,
}: SearchBarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(searchQuery.trim()));

  return (
    <section className="hfis-search" data-no-drag-select>
      <button
        type="button"
        className={`hfis-search-toggle ${searchOpen ? "is-active" : ""}`}
        onClick={() => setSearchOpen((value) => !value)}
        title={t("search.open")}
      >
        <Search size={18} />
      </button>
      <label className={`hfis-search-input ${searchOpen ? "is-open" : ""}`}>
        <Search size={15} />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={t("search.placeholder")}
        />
        {searchQuery && (
          <button type="button" onClick={() => onSearchQueryChange("")} title={t("search.clear")}>
            <X size={14} />
          </button>
        )}
      </label>
      <button
        type="button"
        className={`hfis-fav-filter ${filterFavorite ? "is-active" : ""}`}
        onClick={() => onFilterFavoriteChange(!filterFavorite)}
        title={filterFavorite ? t("search.showAll") : t("search.favoriteOnly")}
      >
        <Star size={18} fill={filterFavorite ? "currentColor" : "none"} />
      </button>
      <AppSelect
        className="hfis-app-select"
        value={filterStatus}
        onChange={(event) => onFilterStatusChange(event.target.value as TaskStatusFilter)}
        title={t("search.statusTitle")}
      >
        <option value="all">{t("status.all")}</option>
        <option value="done">{t("status.done")}</option>
        <option value="running">{t("status.running")}</option>
        <option value="error">{t("status.error")}</option>
      </AppSelect>
    </section>
  );
}
