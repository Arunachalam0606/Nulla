import { create } from 'zustand';
import type { DecryptedNode, UploadQueueItem } from '@/schemas/node';

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface ExplorerState {
  currentParentId: string | null;
  breadcrumbs: BreadcrumbItem[];
  nodes: DecryptedNode[];
  selectedNodeId: string | null;
  viewMode: 'grid' | 'list';
  searchQuery: string;
  isUploadDrawerOpen: boolean;
  uploadQueue: UploadQueueItem[];
  previewNode: DecryptedNode | null;
  isE2eeVaultEnabled: boolean;
  setCurrentParentId: (id: string | null) => void;
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
  pushBreadcrumb: (item: BreadcrumbItem) => void;
  setNodes: (nodes: DecryptedNode[]) => void;
  addNode: (node: DecryptedNode) => void;
  removeNode: (id: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSearchQuery: (query: string) => void;
  setUploadDrawerOpen: (open: boolean) => void;
  setIsE2eeVaultEnabled: (enabled: boolean) => void;
  addUploadQueueItem: (item: UploadQueueItem) => void;
  updateUploadQueueItem: (id: string, updates: Partial<UploadQueueItem>) => void;
  setPreviewNode: (node: DecryptedNode | null) => void;
  reset: () => void;
}

const initialState: Omit<
  ExplorerState,
  | 'setCurrentParentId'
  | 'setBreadcrumbs'
  | 'pushBreadcrumb'
  | 'setNodes'
  | 'addNode'
  | 'removeNode'
  | 'setSelectedNodeId'
  | 'setViewMode'
  | 'setSearchQuery'
  | 'setUploadDrawerOpen'
  | 'setIsE2eeVaultEnabled'
  | 'addUploadQueueItem'
  | 'updateUploadQueueItem'
  | 'setPreviewNode'
  | 'reset'
> = {
  currentParentId: null,
  breadcrumbs: [{ id: null, name: 'Nulla' }],
  nodes: [],
  selectedNodeId: null,
  viewMode: 'grid',
  searchQuery: '',
  isUploadDrawerOpen: false,
  uploadQueue: [],
  previewNode: null,
  isE2eeVaultEnabled: false,
};

export const useExplorerStore = create<ExplorerState>((set) => ({
  ...initialState,

  setCurrentParentId: (id) => set({ currentParentId: id }),

  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),

  pushBreadcrumb: (item) =>
    set((state) => ({ breadcrumbs: [...state.breadcrumbs, item] })),

  setNodes: (nodes) => set({ nodes }),

  addNode: (node) => set((state) => ({ nodes: [node, ...state.nodes] })),

  removeNode: (id) =>
    set((state) => ({ nodes: state.nodes.filter((n) => n.id !== id) })),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setViewMode: (viewMode) => set({ viewMode }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setUploadDrawerOpen: (isUploadDrawerOpen) => set({ isUploadDrawerOpen }),

  setIsE2eeVaultEnabled: (isE2eeVaultEnabled) => set({ isE2eeVaultEnabled }),

  addUploadQueueItem: (item) =>
    set((state) => ({ uploadQueue: [item, ...state.uploadQueue] })),

  updateUploadQueueItem: (id, updates) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  setPreviewNode: (previewNode) => set({ previewNode }),

  reset: () => set(initialState),
}));
