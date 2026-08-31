import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {CircleAlert, Inbox} from './AliIcon';
import {radius, useAppTheme} from '../theme';

type Props = {
  loading?: boolean;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function ScreenState({loading, title, message, actionLabel, onAction}: Props) {
  const theme = useAppTheme();
  if (loading) {
    return (
      <View style={styles.container} accessibilityRole="progressbar">
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text style={[styles.message, {color: theme.colors.textSecondary}]}>正在加载…</Text>
      </View>
    );
  }

  const Icon = onAction ? CircleAlert : Inbox;
  return (
    <View style={styles.container}>
      <View style={[styles.icon, {backgroundColor: theme.colors.surfaceMuted}]}>
        <Icon color={theme.colors.textSecondary} size={28} />
      </View>
      <Text style={[styles.title, {color: theme.colors.text}]}>{title ?? '这里还没有内容'}</Text>
      {message ? <Text style={[styles.message, {color: theme.colors.textSecondary}]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({pressed}) => [styles.action, {backgroundColor: theme.colors.primary, opacity: pressed ? 0.8 : 1}]}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 56},
  icon: {width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16},
  title: {fontSize: 18, fontWeight: '700', textAlign: 'center'},
  message: {fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8},
  action: {minHeight: 48, borderRadius: radius.md, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 20},
  actionLabel: {color: '#FFFFFF', fontWeight: '700', fontSize: 15},
});
