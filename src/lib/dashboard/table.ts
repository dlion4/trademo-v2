"use client";

import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  createTableHook,
  filterFns,
  globalFilteringFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  type SortingState,
} from "@tanstack/react-table";

/**
 * Shared TanStack Table v9 engine for all tradeMO Operator Console tables.
 * Pre-registers sorting + global/column filtering with full type inference.
 */
export const deskTableFeatures = tableFeatures({
  rowSortingFeature,
  globalFilteringFeature,
  columnFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns,
  filterFns,
});

export const {
  useAppTable: useDeskTable,
  createAppColumnHelper: createDeskColumnHelper,
} = createTableHook({
  features: deskTableFeatures,
});

export type { SortingState };
