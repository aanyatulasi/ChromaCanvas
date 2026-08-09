"use client";

import { useSyncExternalStore } from "react";
import { getServerState, getState, subscribe, type PianoState } from "./piano";

/**
 * Subscribe to the piano's loading state.
 *
 * `useSyncExternalStore` rather than an effect-and-state pair because the
 * piano starts loading outside React entirely — the store is the source of
 * truth and a component may mount at any point during the download.
 */
export function usePianoState(): PianoState {
  return useSyncExternalStore(subscribe, getState, getServerState);
}
