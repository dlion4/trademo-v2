"use client";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import { applyLogCommand, streamPage, type LogCommand } from "./model";
import { logKeys, type Filters, type LogsBundle } from "./types";
export function useLogs(initial: LogsBundle) {
  const client = useQueryClient();
  const q = useQuery({
    queryKey: logKeys.workspace,
    queryFn: () => apiFetch<LogsBundle>("/api/logs?section=workspace"),
    initialData: initial,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: async (command: LogCommand) => {
      const next = applyLogCommand(
        client.getQueryData<LogsBundle>(logKeys.workspace) ?? initial,
        command,
      );
      client.setQueryData(logKeys.workspace, next);
      return next;
    },
  });
  return {
    data: q.data,
    mutation,
    reset: () =>
      client.setQueryData(logKeys.workspace, structuredClone(initial)),
  };
}
export function useLogStream(data: LogsBundle, filters: Filters) {
  return useInfiniteQuery({
    queryKey: [...logKeys.stream, { filters, revision: data.revision }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => streamPage(data, filters, pageParam),
    getNextPageParam: (last) => last.next,
    initialData: { pages: [streamPage(data, filters, 0)], pageParams: [0] },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
