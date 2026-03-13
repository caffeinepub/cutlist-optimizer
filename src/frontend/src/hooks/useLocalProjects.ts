import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "cutlist_projects";

export type LocalProject = {
  id: string;
  name: string;
  sheets: Array<{
    sheetLabel: string;
    width: number;
    height: number;
    quantity: bigint;
    laminateFront?: string;
    laminateBack?: string;
  }>;
  pieces: Array<{
    description: string;
    width: number;
    height: number;
    quantity: bigint;
    stockSheetId?: string;
  }>;
  laminateOptions?: string[];
  considerKerf?: boolean;
  kerfValue?: number;
  allowRotation?: boolean;
  createdAt: number;
  updatedAt: number;
};

// Raw shape stored in localStorage (quantity as number)
type StoredProject = {
  id: string;
  name: string;
  sheets: Array<{
    sheetLabel: string;
    width: number;
    height: number;
    quantity: number;
    laminateFront?: string;
    laminateBack?: string;
  }>;
  pieces: Array<{
    description: string;
    width: number;
    height: number;
    quantity: number;
    stockSheetId?: string;
  }>;
  laminateOptions?: string[];
  considerKerf?: boolean;
  kerfValue?: number;
  allowRotation?: boolean;
  createdAt: number;
  updatedAt: number;
};

function readProjects(): StoredProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredProject[];
  } catch {
    return [];
  }
}

function writeProjects(projects: StoredProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function toLocalProject(p: StoredProject): LocalProject {
  return {
    ...p,
    sheets: p.sheets.map((s) => ({ ...s, quantity: BigInt(s.quantity) })),
    pieces: p.pieces.map((pc) => ({ ...pc, quantity: BigInt(pc.quantity) })),
  };
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export function useLocalGetAllProjects() {
  return useQuery<LocalProject[]>({
    queryKey: ["local-projects"],
    queryFn: () => readProjects().map(toLocalProject),
    staleTime: 0,
  });
}

export function useLocalCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      sheets: Array<{
        sheetLabel: string;
        width: number;
        height: number;
        quantity: bigint;
        laminateFront?: string;
        laminateBack?: string;
      }>;
      pieces: Array<{
        description: string;
        width: number;
        height: number;
        quantity: bigint;
        stockSheetId?: string;
      }>;
      laminateOptions?: string[];
      considerKerf?: boolean;
      kerfValue?: number;
      allowRotation?: boolean;
    }) => {
      const projects = readProjects();
      const newProject: StoredProject = {
        id: generateId(),
        name: input.name,
        sheets: input.sheets.map((s) => ({
          ...s,
          quantity: Number(s.quantity),
        })),
        pieces: input.pieces.map((p) => ({
          ...p,
          quantity: Number(p.quantity),
        })),
        laminateOptions: input.laminateOptions,
        considerKerf: input.considerKerf,
        kerfValue: input.kerfValue,
        allowRotation: input.allowRotation,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      projects.push(newProject);
      writeProjects(projects);
      return newProject.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["local-projects"] });
    },
  });
}

export function useLocalUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      sheets: Array<{
        sheetLabel: string;
        width: number;
        height: number;
        quantity: bigint;
        laminateFront?: string;
        laminateBack?: string;
      }>;
      pieces: Array<{
        description: string;
        width: number;
        height: number;
        quantity: bigint;
        stockSheetId?: string;
      }>;
      laminateOptions?: string[];
      considerKerf?: boolean;
      kerfValue?: number;
      allowRotation?: boolean;
    }) => {
      const projects = readProjects();
      const idx = projects.findIndex((p) => p.id === input.id);
      if (idx === -1) throw new Error("Project not found");
      projects[idx] = {
        ...projects[idx],
        name: input.name,
        sheets: input.sheets.map((s) => ({
          ...s,
          quantity: Number(s.quantity),
        })),
        pieces: input.pieces.map((p) => ({
          ...p,
          quantity: Number(p.quantity),
        })),
        laminateOptions: input.laminateOptions,
        considerKerf: input.considerKerf,
        kerfValue: input.kerfValue,
        allowRotation: input.allowRotation,
        updatedAt: Date.now(),
      };
      writeProjects(projects);
      return input.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["local-projects"] });
    },
  });
}

export function useLocalDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const projects = readProjects().filter((p) => p.id !== id);
      writeProjects(projects);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["local-projects"] });
    },
  });
}
