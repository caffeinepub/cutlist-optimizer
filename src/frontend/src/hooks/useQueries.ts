import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Piece, Sheet } from "../backend.d";
import { useActor } from "./useActor";

export function useGetAllProjects() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllProjects();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateProject() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      sheets,
      pieces,
    }: { name: string; sheets: Sheet[]; pieces: Piece[] }) => {
      if (!actor) throw new Error("Not connected");
      return actor.createProject(name, sheets, pieces);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      sheets,
      pieces,
    }: { id: string; name: string; sheets: Sheet[]; pieces: Piece[] }) => {
      if (!actor) throw new Error("Not connected");
      return actor.updateProject(id, name, sheets, pieces);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.deleteProject(projectId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
