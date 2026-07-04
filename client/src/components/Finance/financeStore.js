import { create } from 'zustand';

export const useFinanceStore = create((set) => ({
  transactions: [],
  creditCards: [],
  cashAccount: { totalCashGiven: 0 },
  summary: {
    totalSpent: 0,
    totalCashGiven: 0,
    balance: 0,
    transactionsCount: 0,
    byCategory: {},
    byDate: {},
    cardDues: []
  },
  uploading: false,
  reviewItems: [],
  page: 1,
  totalPages: 1,
  total: 0,
  setUploading: (uploading) => set({ uploading }),
  setReviewItems: (reviewItems) => set({ reviewItems }),
  setTransactionsPayload: ({ data, page, totalPages, total }) => set({
    transactions: data || [],
    page: page || 1,
    totalPages: totalPages || 1,
    total: total || 0
  }),
  setSummary: (summary) => set((state) => ({
    summary: { ...state.summary, ...summary },
    cashAccount: { totalCashGiven: Number(summary?.totalCashGiven || 0) },
    creditCards: Array.isArray(summary?.cardDues) ? summary.cardDues : state.creditCards
  })),
  setCreditCards: (creditCards) => set({ creditCards: creditCards || [] })
}));
