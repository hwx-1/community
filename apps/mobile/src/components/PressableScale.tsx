import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  style,
  pressedStyle,
  pressedScale = 0.985,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...props
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      reduceMotion.current = value;
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      value => {
        reduceMotion.current = value;
      },
    );
    return () => subscription.remove();
  }, []);

  const animate = (value: number) => {
    if (reduceMotion.current) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue: value,
      speed: 32,
      bounciness: 2,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={event => {
        setPressed(true);
        animate(pressedScale);
        onPressIn?.(event);
      }}
      onPressOut={event => {
        setPressed(false);
        animate(1);
        onPressOut?.(event);
      }}
      style={[style, pressed && pressedStyle, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
