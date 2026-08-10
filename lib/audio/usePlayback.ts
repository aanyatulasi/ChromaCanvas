"use client";

import { useSyncExternalStore } from "react";
import {
  getPlaybackServerState,
  getPlaybackState,
  subscribePlayback,
  type PlaybackState,
} from "./transport";

export function usePlayback(): PlaybackState {
  return useSyncExternalStore(subscribePlayback, getPlaybackState, getPlaybackServerState);
}
