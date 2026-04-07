import { useCallback, useLayoutEffect, useRef, type DependencyList } from "react";

const NEAR_BOTTOM_PX = 64;

const NO_RESET_DEPS: DependencyList = [];

/**
 * Keeps a scrollable node pinned to the bottom only while the user is already
 * near the bottom, so reading older lines upstream does not jump on each new log line.
 */
export function useStickToBottomScroll<T extends HTMLElement>(
  scrollWhenDeps: DependencyList,
  options?: { resetStickToBottomWhen?: DependencyList },
) {
  const ref = useRef<T | null>(null);
  const stickToBottomRef = useRef(true);

  useLayoutEffect(() => {
    stickToBottomRef.current = true;
  }, options?.resetStickToBottomWhen ?? NO_RESET_DEPS);

  const onScroll = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    stickToBottomRef.current = distanceFromBottom < NEAR_BOTTOM_PX;
  }, []);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (stickToBottomRef.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, scrollWhenDeps);

  return { ref, onScroll };
}
