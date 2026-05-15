import { useMemo, useState } from "react";
import { generateImageTask, hasEnterpriseGateway } from "../hostBridge";
import type { ImageStudioTask, ReferenceImage, StudioParams } from "../types";
import { StudioComposer } from "./StudioComposer";
import { StudioHero } from "./StudioHero";
import { StudioSidebar } from "./StudioSidebar";
import { TaskGrid } from "./TaskGrid";

const DEFAULT_PARAMS: StudioParams = {
  model: "gpt-image-1",
  size: "1024x1024",
  quality: "auto",
  count: 1,
};

export function ImageStudioPanel() {
  const [prompt, setPrompt] = useState("");
  const [params, setParams] = useState<StudioParams>(DEFAULT_PARAMS);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [tasks, setTasks] = useState<ImageStudioTask[]>([]);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const gatewayReady = hasEnterpriseGateway();

  const visibleTasks = useMemo(() => {
    return filter === "favorites" ? tasks.filter((task) => task.favorite) : tasks;
  }, [filter, tasks]);

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
      status: "running",
      error: null,
      favorite: false,
      createdAt: Date.now(),
      finishedAt: null,
    };
    setTasks((current) => [task, ...current]);
    try {
      const result = await generateImageTask({ prompt: trimmed, params, references });
      setTasks((current) => current.map((item) => item.id === task.id
        ? { ...item, ...result, status: "done", finishedAt: Date.now() }
        : item));
      setPrompt("");
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
    const next = await Promise.all(Array.from(files).map(readReferenceImage));
    setReferences((current) => [...current, ...next]);
  }

  function retryTask(task: ImageStudioTask) {
    setPrompt(task.prompt);
    setParams(task.params);
    setReferences(task.references);
  }

  function toggleFavorite(taskId: string) {
    setTasks((current) => current.map((task) => task.id === taskId
      ? { ...task, favorite: !task.favorite }
      : task));
  }

  return (
    <div className="hfis-root">
      <StudioSidebar
        gatewayReady={gatewayReady}
        filter={filter}
        tasks={tasks}
        onFilterChange={setFilter}
        onReuseTask={retryTask}
      />

      <main className="hfis-main">
        <StudioHero />

        <StudioComposer
          prompt={prompt}
          params={params}
          references={references}
          gatewayReady={gatewayReady}
          onPromptChange={setPrompt}
          onParamsChange={setParams}
          onAttachReferences={(files) => void attachReferences(files)}
          onSubmit={() => void submit()}
        />

        <TaskGrid
          tasks={visibleTasks}
          onReuseTask={retryTask}
          onToggleFavorite={toggleFavorite}
        />
      </main>
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
