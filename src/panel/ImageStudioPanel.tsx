import { useEffect, useMemo, useState } from "react";
import { useHostTheme } from "@haloforge/plugin-sdk";
import { generateImageTask, getGatewayState } from "../hostBridge";
import { useImageStudioT } from "../i18n";
import {
  clearStoredTasks,
  createDefaultParams,
  loadStoredSettings,
  loadStoredTasks,
  saveStoredSettings,
  saveStoredTasks,
} from "../storage";
import type { ImageStudioTask, ReferenceImage, StudioParams, StudioSettings, TaskStatusFilter } from "../types";
import { Lightbox } from "./Lightbox";
import { SearchBar } from "./SearchBar";
import { SettingsModal } from "./SettingsModal";
import { StudioComposer } from "./StudioComposer";
import { StudioHeader } from "./StudioHeader";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskGrid } from "./TaskGrid";

export function ImageStudioPanel() {
  const { theme } = useHostTheme();
  const t = useImageStudioT();
  const [settings, setSettings] = useState<StudioSettings>(() => loadStoredSettings());
  const [prompt, setPrompt] = useState("");
  const [params, setParams] = useState<StudioParams>(() => createDefaultParams(loadStoredSettings()));
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [tasks, setTasks] = useState<ImageStudioTask[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatusFilter>("all");
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const gatewayState = getGatewayState(settings);
  const gatewayReady = gatewayState.ready;

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      if (filterFavorite && !task.favorite) return false;
      if (filterStatus !== "all" && task.status !== filterStatus) return false;
      if (!query) return true;
      return task.prompt.toLowerCase().includes(query) || JSON.stringify(task.params).toLowerCase().includes(query);
    });
  }, [filterFavorite, filterStatus, searchQuery, tasks]);

  const selectedCount = selectedTaskIds.length;
  const detailTask = detailTaskId ? tasks.find((task) => task.id === detailTaskId) ?? null : null;

  useEffect(() => {
    let cancelled = false;
    loadStoredTasks()
      .then((storedTasks) => {
        if (!cancelled) setTasks(storedTasks);
      })
      .finally(() => {
        if (!cancelled) setTasksLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveStoredSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (tasksLoaded && settings.persistHistory) void saveStoredTasks(tasks);
  }, [settings.persistHistory, tasks, tasksLoaded]);

  async function submit() {
    const trimmed = prompt.trim();
    if (!trimmed || !gatewayReady) return;
    const task: ImageStudioTask = {
      id: crypto.randomUUID(),
      prompt: trimmed,
      params,
      references,
      outputs: [],
      assets: [],
      revisedPrompt: null,
      outputSizes: [],
      status: "running",
      error: null,
      favorite: false,
      selected: false,
      createdAt: Date.now(),
      finishedAt: null,
    };

    setTasks((current) => [task, ...current]);
    try {
      const result = await generateImageTask({ prompt: trimmed, params, references, settings });
      const sizes = await Promise.all(result.outputs.map(readImageSize));
      setTasks((current) => current.map((item) => item.id === task.id
        ? { ...item, ...result, outputSizes: sizes, status: "done", finishedAt: Date.now() }
        : item));
      if (settings.clearPromptAfterSubmit) setPrompt("");
    } catch (error) {
      setTasks((current) => current.map((item) => item.id === task.id
        ? {
          ...item,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
          finishedAt: Date.now(),
        }
        : item));
    }
  }

  async function attachReferences(files: FileList | null) {
    if (!files?.length) return;
    const next = await Promise.all(Array.from(files).slice(0, 16 - references.length).map(readReferenceImage));
    setReferences((current) => [...current, ...next].slice(0, 16));
  }

  function removeReference(id: string) {
    setReferences((current) => current.filter((reference) => reference.id !== id));
  }

  function retryTask(task: ImageStudioTask) {
    setPrompt(task.prompt);
    setParams(task.params);
    setReferences(task.references);
  }

  function editFromTask(task: ImageStudioTask) {
    const outputReferences = task.outputs.map((output, index) => ({
      id: crypto.randomUUID(),
      name: `output-${index + 1}.png`,
      contentType: "image/png",
      dataUrl: output,
    }));
    setPrompt(task.revisedPrompt ?? task.prompt);
    setParams(task.params);
    setReferences(outputReferences.slice(0, 16));
  }

  function updateReferenceMask(referenceId: string, maskDataUrl: string | null) {
    setReferences((current) => current.map((reference) => reference.id === referenceId
      ? { ...reference, maskDataUrl }
      : { ...reference, maskDataUrl: null }));
  }

  function toggleFavorite(taskId: string) {
    setTasks((current) => current.map((task) => task.id === taskId
      ? { ...task, favorite: !task.favorite }
      : task));
  }

  function deleteTask(taskId: string) {
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setSelectedTaskIds((current) => current.filter((id) => id !== taskId));
    if (detailTaskId === taskId) setDetailTaskId(null);
  }

  function toggleSelection(taskId: string) {
    setSelectedTaskIds((current) => current.includes(taskId)
      ? current.filter((id) => id !== taskId)
      : [...current, taskId]);
  }

  function clearSelection() {
    setSelectedTaskIds([]);
  }

  function selectVisible() {
    setSelectedTaskIds((current) => current.length === filteredTasks.length ? [] : filteredTasks.map((task) => task.id));
  }

  function favoriteSelected() {
    const selected = new Set(selectedTaskIds);
    setTasks((current) => current.map((task) => selected.has(task.id) ? { ...task, favorite: true } : task));
    clearSelection();
  }

  function deleteSelected() {
    const selected = new Set(selectedTaskIds);
    setTasks((current) => current.filter((task) => !selected.has(task.id)));
    clearSelection();
  }

  function updateSettings(next: StudioSettings) {
    setSettings(next);
    setParams((current) => ({
      ...current,
      model: current.model === settings.defaultModel ? next.defaultModel : current.model,
      size: current.size === settings.defaultSize ? next.defaultSize : current.size,
    }));
  }

  function clearHistory() {
    setTasks([]);
    setSelectedTaskIds([]);
    setDetailTaskId(null);
    void clearStoredTasks();
  }

  function attachDroppedFiles(event: React.DragEvent) {
    event.preventDefault();
    void attachReferences(event.dataTransfer.files);
  }

  function attachPastedFiles(event: React.ClipboardEvent) {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    event.preventDefault();
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    void attachReferences(transfer.files);
  }

  return (
    <div
      className="hfis-root"
      data-hfis-theme={theme.type}
      onDrop={attachDroppedFiles}
      onDragOver={(event) => event.preventDefault()}
      onPaste={attachPastedFiles}
    >
      <StudioHeader
        title={t("app.title")}
        settingsTitle={t("settings.title")}
        gatewayReady={gatewayReady}
        gatewayStatus={t(gatewayState.labelKey)}
        taskCount={tasks.length}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      <div className="hfis-toolbar">
        <SearchBar
          t={t}
          filterFavorite={filterFavorite}
          filterStatus={filterStatus}
          searchQuery={searchQuery}
          onFilterFavoriteChange={setFilterFavorite}
          onFilterStatusChange={setFilterStatus}
          onSearchQueryChange={setSearchQuery}
        />
      </div>

      <main className="hfis-main" data-drag-select-surface>
        <TaskGrid
          t={t}
          tasks={filteredTasks}
          selectedTaskIds={selectedTaskIds}
          onReuseTask={retryTask}
          onEditTask={editFromTask}
          onDeleteTask={deleteTask}
          onToggleFavorite={toggleFavorite}
          onToggleSelection={toggleSelection}
          onOpenTask={(task) => setDetailTaskId(task.id)}
          onOpenLightbox={(images, index) => setLightbox({ images, index })}
        />
      </main>

      <StudioComposer
        t={t}
        prompt={prompt}
        params={params}
        references={references}
        gatewayReady={gatewayReady}
        selectedCount={selectedCount}
        totalVisibleCount={filteredTasks.length}
        onPromptChange={setPrompt}
        onParamsChange={setParams}
        onAttachReferences={(files) => void attachReferences(files)}
        onRemoveReference={removeReference}
        onUpdateReferenceMask={updateReferenceMask}
        onSubmit={() => void submit()}
        onClearSelection={clearSelection}
        onSelectVisible={selectVisible}
        onFavoriteSelected={favoriteSelected}
        onDeleteSelected={deleteSelected}
      />

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          t={t}
          onClose={() => setDetailTaskId(null)}
          onReuse={(task) => {
            retryTask(task);
            setDetailTaskId(null);
          }}
          onEdit={(task) => {
            editFromTask(task);
            setDetailTaskId(null);
          }}
          onDelete={deleteTask}
          onToggleFavorite={toggleFavorite}
          onOpenLightbox={(images, index) => setLightbox({ images, index })}
        />
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          t={t}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox({ ...lightbox, index })}
          onClose={() => setLightbox(null)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          t={t}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
          onClearHistory={clearHistory}
        />
      )}
    </div>
  );
}

function readReferenceImage(file: File): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
    reader.onload = () => resolve({
      id: crypto.randomUUID(),
      name: file.name,
      contentType: file.type || "image/png",
      dataUrl: String(reader.result),
    });
    reader.readAsDataURL(file);
  });
}

function readImageSize(src: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(`${image.naturalWidth}x${image.naturalHeight}`);
    image.onerror = () => resolve("");
    image.src = src;
  });
}
