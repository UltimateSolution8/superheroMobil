import { useCallback, useRef } from 'react';
import type { ScrollView } from 'react-native';

export function useScrollToFocusedInput() {
  const scrollRef = useRef<ScrollView | null>(null);

  const onInputFocus = useCallback((event: any) => {
    const target = event?.nativeEvent?.target;
    const responder = scrollRef.current as unknown as {
      scrollResponderScrollNativeHandleToKeyboard?: (
        nodeHandle: number,
        additionalOffset?: number,
        preventNegativeScrollOffset?: boolean,
      ) => void;
    } | null;
    if (!target || !responder?.scrollResponderScrollNativeHandleToKeyboard) return;
    setTimeout(() => {
      responder.scrollResponderScrollNativeHandleToKeyboard?.(target, 100, true);
    }, 60);
  }, []);

  return { scrollRef, onInputFocus };
}
