import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ducksApi } from './client';
import type { CreateDuckInput, UpdateDuckInput } from './types';

export const ducksQueryKey = ['ducks'] as const;

export function useDucks() {
  return useQuery({ queryKey: ducksQueryKey, queryFn: ducksApi.list });
}

/**
 * Every mutation refetches the list once it settles, success or failure. A failed edit or
 * delete usually means the duck changed underneath the user, so the list is stale then too.
 */
function useInvalidateDucks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ducksQueryKey });
}

export function useCreateDuck() {
  const onSettled = useInvalidateDucks();
  return useMutation({ mutationFn: (input: CreateDuckInput) => ducksApi.create(input), onSettled });
}

export function useUpdateDuck() {
  const onSettled = useInvalidateDucks();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateDuckInput }) => ducksApi.update(id, input),
    onSettled,
  });
}

export function useDeleteDuck() {
  const onSettled = useInvalidateDucks();
  return useMutation({ mutationFn: (id: number) => ducksApi.remove(id), onSettled });
}
