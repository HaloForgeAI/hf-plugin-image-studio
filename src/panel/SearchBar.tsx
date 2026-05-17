import { AppTooltip } from "@haloforge/plugin-sdk";
import { Search, Star, X } from "lucide-react";
import { useState } from "react";
import type { ImageStudioT } from "../i18n";
import type { TaskStatusFilter } from "../types";
import { ClosingAppSelect as AppSelect } from "./ClosingAppSelect";

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
      <AppTooltip content={t("search.open")} placement="bottom">
        <button
          type="button"
          className={`hfis-search-toggle ${searchOpen ? "is-active" : ""}`}
          onClick={() => setSearchOpen((value) => !value)}
          aria-label={t("search.open")}
        >
          <Search size={18} />
        </button>
      </AppTooltip>
      <label className={`hfis-search-input ${searchOpen ? "is-open" : ""}`}>
        <Search size={15} />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={t("search.placeholder")}
        />
        {searchQuery && (
          <AppTooltip content={t("search.clear")} placement="bottom">
            <button type="button" onClick={() => onSearchQueryChange("")} aria-label={t("search.clear")}>
              <X size={14} />
            </button>
          </AppTooltip>
        )}
      </label>
      <AppTooltip content={filterFavorite ? t("search.showAll") : t("search.favoriteOnly")} placement="bottom">
        <button
          type="button"
          className={`hfis-fav-filter ${filterFavorite ? "is-active" : ""}`}
          onClick={() => onFilterFavoriteChange(!filterFavorite)}
          aria-label={filterFavorite ? t("search.showAll") : t("search.favoriteOnly")}
        >
          <Star size={18} fill={filterFavorite ? "currentColor" : "none"} />
        </button>
      </AppTooltip>
      <AppTooltip content={t("search.statusTitle")} placement="bottom">
        <AppSelect
          className="hfis-app-select"
          value={filterStatus}
          onChange={(event) => onFilterStatusChange(event.target.value as TaskStatusFilter)}
          aria-label={t("search.statusTitle")}
        >
          <option value="all">{t("status.all")}</option>
          <option value="done">{t("status.done")}</option>
          <option value="running">{t("status.running")}</option>
          <option value="error">{t("status.error")}</option>
        </AppSelect>
      </AppTooltip>
    </section>
  );
}
